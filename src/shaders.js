import {SOLAR_DAWN_HOUR} from './solar.js';
export const vertex = `#version 300 es
out vec2 uv;
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);uv=p;gl_Position=vec4(p*2.-1.,0,1);}`;

export const fragment = `#version 300 es
precision highp float;
precision highp sampler3D;
in vec2 uv;
out vec4 fragColor;
uniform vec2 resolution;
uniform vec4 viewRect;
uniform float landscapeEnabled;
uniform sampler3D noiseMap;
uniform float hour, drift, coverage;
uniform int steps;
const float PI=3.14159265;
float sat(float x){return clamp(x,0.,1.);}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float hg(float c,float g){return (1.-g*g)/pow(max(.05,1.+g*g-2.*g*c),1.5);}
// A continuous volume, softened at the floor and carved away toward the top.
// Low frequencies form cloud masses; higher frequencies erode their edges.
float twilightWeight;
float daytimeDensity(vec3 p){
 float h=(p.y-1.4)/2.8;
 if(h<=0.||h>=1.||coverage<.01)return 0.;
 vec3 q=p*vec3(.095,.16,.095)+vec3(drift*.018,0.,drift*.006);
 float base=texture(noiseMap,q).r;
 float billow=texture(noiseMap,q*2.03+vec3(.31,.17,.53)).g;
 float fine=texture(noiseMap,q*5.1).g;
 float detail=texture(noiseMap,q*12.7).g;
 float shape=base*.68+billow*.32;
 float threshold=mix(.72,.30,coverage);
 threshold+=pow(h,2.)*.21;
 float body=smoothstep(threshold,threshold+.18,shape);
 float erosion=(1.-billow)*.22+(1.-fine)*.20+(1.-detail)*.10;
 body=max(0.,body-erosion*(1.-body*.75));
 return body*smoothstep(0.,.12,h)*(1.-smoothstep(.64,1.,h))*1.45;
}
// Long cloud streets recede along the view direction. Perspective makes them
// converge at the hills and fan out past the top of the fixed camera.
float twilightDensity(vec3 p){
 float h=(p.y-1.4)/2.8;
 if(h<=0.||h>=1.||coverage<.01)return 0.;
 float across=p.x-.22*p.z;
 vec3 q=vec3(across*.17,p.y*.24,p.z*.025)+vec3(.31,.17,.48);
 q+=vec3(drift*.00012,0.,drift*.00004);
 float broad=texture(noiseMap,q).r;
 float shoulder=texture(noiseMap,q*2.3+vec3(.21,.39,.13)).g;
 float fine=texture(noiseMap,vec3(across*.65,p.y*.8,p.z*.15)+.27).g;
 // Uneven ribbons, broken by noise rather than evenly spaced solid stripes.
 float ribbons=.5+.5*sin(across*1.6+(broad-.5)*5.);
 float field=ribbons*.28+broad*.42+shoulder*.30;
 float threshold=mix(.79,.39,coverage);
 float body=smoothstep(threshold,threshold+.18,field);
 body=max(0.,body-(1.-fine)*.32);
 float envelope=smoothstep(.20,.38,h)*(1.-smoothstep(.55,.76,h));
 return body*envelope*.85;
}
float density(vec3 p){
 if(twilightWeight<.001)return daytimeDensity(p);
 if(twilightWeight>.999)return twilightDensity(p);
 return mix(daytimeDensity(p),twilightDensity(p),twilightWeight);
}
vec3 skyColor(vec3 rd,vec3 sun,float day,float dusk){
 float elevation=pow(max(rd.y,0.),.45);
 vec3 zenith=mix(vec3(.006,.011,.028),vec3(.045,.19,.47),day);
 vec3 horizon=mix(vec3(.026,.033,.065),vec3(.67,.79,.89),day);
 float facing=pow(max(dot(normalize(vec3(rd.x,.0,rd.z)),normalize(vec3(sun.x,0.,sun.z))),0.),5.);
 horizon=mix(horizon,vec3(.96,.32,.105),dusk*(.35+.65*facing));
 zenith=mix(zenith,vec3(.18,.17,.35),dusk*.45);
 vec3 col=mix(horizon,zenith,elevation);
 float mu=dot(rd,sun);
 col+=vec3(1.,.58,.27)*pow(max(mu,0.),28.)*dusk*.5;
 col+=vec3(1.,.87,.66)*pow(max(mu,0.),180.)*day*.15;
 float disc=smoothstep(.99989,.99994,mu)*smoothstep(-.03,.015,sun.y);
 col+=vec3(1.,.83,.58)*disc*7.;
 vec3 moon=normalize(vec3(-sun.x,.48,-sun.z));
 col+=vec3(.65,.75,1.)*smoothstep(.99980,.99987,dot(rd,moon))*(1.-day)*1.8;
 return col;
}
void main(){
 vec2 screen=uv*2.-1.;screen.x*=resolution.x/resolution.y;
 // Camera is tilted upward: the horizon sits just beneath the frame.
 vec3 rd=normalize(vec3(screen.x*.72,screen.y*.62+.76,1.3));
 if(landscapeEnabled>.5){vec2 imageUV=viewRect.xy+uv*viewRect.zw;rd=normalize(vec3((imageUV.x*2.-1.)*1.25,(imageUV.y*2.-1.)*.70+.10,1.3));}
 float angle=(hour-${SOLAR_DAWN_HOUR.toFixed(1)})/24.*2.*PI;
 vec3 sun=normalize(vec3(cos(angle)*.85,sin(angle),.65));
 float day=smoothstep(-.17,.18,sun.y);
 twilightWeight=(1.-smoothstep(.13,.48,sun.y))*smoothstep(-.34,-.13,sun.y);
 float dusk=exp(-pow((sun.y-.015)/.19,2.));
 vec3 background=skyColor(rd,sun,day,dusk);
 vec3 result=background;
 float starTransmission=1.;
 if(rd.y>.015){
  float nearT=1.4/rd.y,farT=min(4.2/rd.y,nearT+65.);
  float dt=(farT-nearT)/float(steps);
  float jitter=hash(gl_FragCoord.xy);
  float transmission=1.;vec3 scatter=vec3(0.);
  vec3 moonLight=normalize(vec3(-sun.x,.48,-sun.z));
  vec3 lightDir=normalize(mix(moonLight,sun,smoothstep(-.23,-.08,sun.y)));
  float mu=dot(rd,lightDir);
  float phase=.7*hg(mu,.55)+.3*hg(mu,-.2);
  vec3 sunlight=mix(vec3(.055,.075,.13),mix(vec3(1.,.34,.12),vec3(1.,.96,.86),smoothstep(.0,.4,sun.y))*1.7,day);
  sunlight+=vec3(1.05,.42,.10)*twilightWeight*(.2+.7*smoothstep(-.25,.12,sun.y));
  vec3 ambient=mix(vec3(.018,.03,.06),vec3(.36,.49,.68),day);
  ambient=mix(ambient,vec3(.32,.19,.24),dusk*.45);
  for(int i=0;i<96;i++){
   if(i>=steps)break;
   vec3 p=rd*(nearT+(float(i)+jitter)*dt);
   float d=density(p);
   if(d>.005){
    float optical=0.;
    // Exponentially spaced light samples approximate self-shadowing.
    optical+=density(p+lightDir*.16)*.3;
    optical+=density(p+lightDir*.5)*.6;
    optical+=density(p+lightDir*1.2)*1.2;
    optical+=density(p+lightDir*2.6)*2.;
    float direct=exp(-optical*2.1);
    float multiple=.24*exp(-optical*.5)+.10*exp(-optical*.13);
    float h=sat((p.y-1.4)/2.8);
    vec3 lighting=sunlight*(direct*phase*.45+multiple)+ambient*(.45+.55*h);
    float alpha=1.-exp(-d*dt*2.5);
    scatter+=transmission*alpha*lighting;
    transmission*=1.-alpha;
    if(transmission<.012)break;
   }
  }
  // Aerial perspective keeps distant cloud banks from becoming a hard wall.
  float haze=1.-exp(-nearT*mix(.012,.027,landscapeEnabled));
  result=mix(scatter+background*transmission,background,haze);
  starTransmission=mix(transmission,1.,haze);
 }
 // Gentle filmic compression and display gamma.
 result=1.-exp(-result*1.25);
 result=pow(max(result,vec3(0.)),vec3(1./2.2));
 result+=(hash(gl_FragCoord.xy+17.)-.5)/255.;
 fragColor=vec4(result,starTransmission);
}`;
