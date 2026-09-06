import {compileProgram} from './landscape.js';
import {vertex as fullscreenVertex} from './shaders.js';

const vertex=`#version 300 es
precision highp float;
layout(location=0) in vec3 direction;
layout(location=1) in float brightness;
layout(location=2) in float warmth;
uniform float hour,aspect,pixelRatio,enabled;
uniform vec4 viewRect;
out float energy;
out vec3 tint;
void main(){
 float spin=-hour/24.*6.28318530718;
 vec3 axis=normalize(vec3(.18,.75,.63));
 vec3 d=direction*cos(spin)+cross(axis,direction)*sin(spin)+axis*dot(axis,direction)*(1.-cos(spin));
 vec2 screen;
 if(enabled>.5){
  vec2 imageUV=vec2(.5+(d.x/max(d.z,.001)*1.3)/2.5,.5+(d.y/max(d.z,.001)*1.3-.10)/1.4);
  screen=(imageUV-viewRect.xy)/viewRect.zw*2.-1.;
 }else{
  screen=vec2(d.x/max(d.z,.001)*1.3/(.72*aspect),(d.y/max(d.z,.001)*1.3-.76)/.62);
 }
 gl_Position=vec4(screen,0.,1.);
 if(d.z<=0.||d.y<=0.)gl_Position=vec4(3.,3.,0.,1.);
 gl_PointSize=6.*pixelRatio;
 float angle=(hour-6.)/24.*6.28318530718;
 float solar=sin(angle)/length(vec3(cos(angle)*.85,sin(angle),.65));
 float night=1.-smoothstep(-.28,-.10,solar);
 energy=brightness*night*smoothstep(0.,.18,d.y);
 tint=mix(vec3(.78,.86,1.),vec3(1.,.91,.76),warmth);
}`;
const fragment=`#version 300 es
precision highp float;
in float energy;
in vec3 tint;
uniform sampler2D skyMap,landscapeMap;
uniform vec2 resolution;
uniform vec4 viewRect;
uniform float enabled,ready;
out vec4 outColor;
void main(){
 vec2 uv=gl_FragCoord.xy/resolution;
 float visibility=texture(skyMap,uv).a;
 if(enabled>.5&&ready>.5){
  vec2 p=viewRect.xy+uv*viewRect.zw;
  vec3 photo=texture(landscapeMap,p).rgb;
  float sky=smoothstep(.05,.40,min(photo.r,photo.b)-photo.g)*smoothstep(.26,.33,p.y);
  visibility*=sky;
 }
 // A ~1.5 CSS-pixel FWHM footprint spreads light continuously across pixels.
 // Fixed star brightness: no clock noise, per-frame reseeding, or twinkle term.
 vec2 pixel=(gl_PointCoord-.5)*6.;
 float gaussian=exp(-dot(pixel,pixel)/(2.*.7*.7));
 outColor=vec4(tint*energy*gaussian*visibility,0.);
}`;

const galaxyFragment=`#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D galaxyMap,skyMap,landscapeMap;
uniform vec4 viewRect;
uniform float hour,aspect,enabled,ready;
out vec4 outColor;
void main(){
 vec2 screen=uv*2.-1.;
 vec3 d=normalize(vec3(screen.x*aspect*.72,screen.y*.62+.76,1.3));
 if(enabled>.5){vec2 p=viewRect.xy+uv*viewRect.zw;d=normalize(vec3((p.x*2.-1.)*1.25,(p.y*2.-1.)*.70+.10,1.3));}
 float horizon=smoothstep(0.,.18,d.y);
 float spin=hour/24.*6.28318530718;
 vec3 axis=normalize(vec3(.18,.75,.63));
 d=d*cos(spin)+cross(axis,d)*sin(spin)+axis*dot(axis,d)*(1.-cos(spin));
 // Fixed artistic orientation of the panorama; the spin matches the catalogue.
 vec3 centre=normalize(vec3(0.,.35,1.));
 vec3 tangent=normalize(vec3(.87,.45,-.16));
 tangent=normalize(tangent-centre*dot(tangent,centre));
 vec3 north=normalize(cross(centre,tangent));
 vec2 coord=vec2(.5+atan(dot(d,tangent),dot(d,centre))/6.28318530718,.5+asin(clamp(dot(d,north),-1.,1.))/3.14159265359);
 // Wrapped derivatives prevent a false coarse mip at the longitude seam.
 vec2 dx=dFdx(coord),dy=dFdy(coord);dx.x-=round(dx.x);dy.x-=round(dy.x);
 vec3 glow=textureGrad(galaxyMap,coord,dx,dy).rgb;
 float edge=min(coord.x,1.-coord.x);
 vec3 join=(textureLod(galaxyMap,vec2(.002,coord.y),2.).rgb+textureLod(galaxyMap,vec2(.998,coord.y),2.).rgb)*.5;
 glow=mix(join,glow,smoothstep(0.,.015,edge));
 float polar=smoothstep(.965,1.,abs(coord.y*2.-1.));
 glow=mix(glow,textureLod(galaxyMap,vec2(.5,coord.y),8.).rgb,polar);
 float angle=(hour-6.)/24.*6.28318530718;
 float solar=sin(angle)/length(vec3(cos(angle)*.85,sin(angle),.65));
 float visibility=(1.-smoothstep(-.28,-.10,solar))*horizon*texture(skyMap,uv).a;
 if(enabled>.5&&ready>.5){vec2 p=viewRect.xy+uv*viewRect.zw;vec3 photo=texture(landscapeMap,p).rgb;visibility*=smoothstep(.05,.40,min(photo.r,photo.b)-photo.g)*smoothstep(.26,.33,p.y);}
 outColor=vec4(max(glow-vec3(.012),vec3(0.))*.45*visibility,0.);
}`;

export class Stars {
 constructor(gl){
  this.gl=gl;this.galaxyReady=false;
  this.galaxyProgram=compileProgram(gl,fullscreenVertex,galaxyFragment);
  this.galaxyUniforms=Object.fromEntries(['hour','aspect','enabled','viewRect','skyMap','landscapeMap','galaxyMap','ready'].map(n=>[n,gl.getUniformLocation(this.galaxyProgram,n)]));
  this.galaxyVao=gl.createVertexArray();this.galaxyTexture=gl.createTexture();
  const image=new Image();image.onload=()=>{
   if(gl.isContextLost())return;
   gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,this.galaxyTexture);
   gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
   gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
   this.galaxyReady=true;document.querySelector('#sky').dataset.milkyWay='ready';
  };image.onerror=()=>console.warn('Milky Way image unavailable; retaining the star catalogue.');image.src='/assets/milky-way.png';
  this.program=compileProgram(gl,vertex,fragment);
  this.uniforms=Object.fromEntries(['hour','aspect','pixelRatio','enabled','viewRect','skyMap','landscapeMap','resolution','ready'].map(n=>[n,gl.getUniformLocation(this.program,n)]));
  // A deterministic synthetic catalogue distributed evenly over a sphere.
  // It is generated once; only the shared orientation changes with time.
  this.count=3200;const data=new Float32Array(this.count*5);let seed=94713;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<this.count;i++){
   const y=1-2*(i+.5)/this.count,r=Math.sqrt(1-y*y),a=i*2.399963229728653+(random()-.5)*.06;
   data.set([Math.cos(a)*r,y,Math.sin(a)*r,.10+.65*Math.pow(random(),3),random()],i*5);
  }
  this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);
  this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
  for(const [index,size,offset] of [[0,3,0],[1,1,12],[2,1,16]]){gl.enableVertexAttribArray(index);gl.vertexAttribPointer(index,size,gl.FLOAT,false,20,offset);}
  gl.bindVertexArray(null);
 }
 draw(state,rect,width,height,ready){
  const gl=this.gl,u=this.uniforms;
  if(this.galaxyReady){
   const g=this.galaxyUniforms;gl.useProgram(this.galaxyProgram);gl.bindVertexArray(this.galaxyVao);
   gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,this.galaxyTexture);gl.uniform1i(g.galaxyMap,3);
   gl.uniform1i(g.skyMap,1);gl.uniform1i(g.landscapeMap,2);gl.uniform1f(g.hour,((state.hour%24)+24)%24);
   gl.uniform1f(g.aspect,width/height);gl.uniform1f(g.enabled,state.scene==='landscape'?1:0);gl.uniform1f(g.ready,ready?1:0);gl.uniform4fv(g.viewRect,rect);
   gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);gl.drawArrays(gl.TRIANGLES,0,3);gl.disable(gl.BLEND);
  }
  gl.useProgram(this.program);gl.bindVertexArray(this.vao);
  gl.uniform1f(u.hour,((state.hour%24)+24)%24);gl.uniform1f(u.aspect,width/height);
  gl.uniform1f(u.pixelRatio,width/innerWidth);gl.uniform1f(u.enabled,state.scene==='landscape'?1:0);gl.uniform1f(u.ready,ready?1:0);
  gl.uniform4fv(u.viewRect,rect);gl.uniform2f(u.resolution,width,height);
  gl.uniform1i(u.skyMap,1);gl.uniform1i(u.landscapeMap,2);
  gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);gl.drawArrays(gl.POINTS,0,this.count);gl.disable(gl.BLEND);
  gl.bindVertexArray(null);
 }
}
