import {vertex} from './shaders.js';

const fragment = `#version 300 es
precision highp float;
precision highp sampler3D;
in vec2 uv;
out vec4 fragColor;
uniform sampler2D skyMap, landscapeMap;
uniform sampler3D noiseMap;
uniform vec4 viewRect;
uniform float hour, drift, coverage, ready, enabled;
float sat(float x){return clamp(x,0.,1.);}
vec3 linear(vec3 c){return pow(max(c,vec3(0.)),vec3(2.2));}
void main(){
 vec3 sky=texture(skyMap,uv).rgb;
 if(ready<.5||enabled<.5){fragColor=vec4(sky,1.);return;}
 vec2 p=viewRect.xy+uv*viewRect.zw;
 vec4 photo=texture(landscapeMap,p);
 // Chroma separation is limited to the skyline; purple flowers stay intact.
 float key=smoothstep(.05,.40,min(photo.r,photo.b)-photo.g)*smoothstep(.26,.33,p.y);
 float alpha=1.-key;
 if(alpha<.005){fragColor=vec4(sky,1.);return;}
 // Remove magenta contamination in antialiased branches and silhouette edges.
 vec3 color=max(vec3(0.),(photo.rgb-vec3(1.,0.,1.)*key)/max(alpha,.03));
 color=linear(clamp(color,0.,1.));
 float angle=(hour-6.)/24.*6.2831853;
 vec3 sun=normalize(vec3(cos(angle)*.85,sin(angle),.65));
 float day=smoothstep(-.16,.22,sun.y);
 float golden=exp(-pow((sun.y-.08)/.26,2.));
 float nearGround=1.-smoothstep(.12,.43,p.y);
 // Approximate surface orientation for this fixed photograph, not recovered geometry.
 float slope=smoothstep(.55,.88,p.x)*nearGround;
 vec3 normal=normalize(vec3(-slope*.5,.85,.18));
 float direct=max(dot(normal,sun),0.);
 vec3 light=mix(vec3(.018,.029,.065),vec3(.57)+direct*.53,day);
 light*=mix(vec3(1.),vec3(1.38,.76,.43),golden*.72);
 // The same weather noise and clock used by the volumetric cloud pass.
 float distance=1./max(.12,.53-p.y);
 vec3 world=vec3((p.x-.5)*distance*4.,0.,distance*1.7);
 vec3 shadowPoint=world+sun*(2.5/max(sun.y,.18));
 float weather=texture(noiseMap,shadowPoint*.095+vec3(drift*.018,0.,drift*.006)).r;
 float shadow=smoothstep(mix(.75,.35,coverage),mix(.88,.57,coverage),weather);
 light*=1.-shadow*.22*day;
 color*=light;
 // Distant hills take on the ambient sky hue before the foreground does.
 float distant=smoothstep(.30,.44,p.y)*.15;
 vec3 air=mix(vec3(.009,.016,.038),mix(vec3(.44,.55,.67),vec3(.58,.29,.18),golden),day);
 color=mix(color,air,distant);
 color=pow(max(color,vec3(0.)),vec3(1./2.2));
 fragColor=vec4(mix(sky,color,alpha),1.);
}`;

export function compileProgram(gl, vs, fs) {
 const program=gl.createProgram();
 for(const [type, source] of [[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]]) {
  const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
  if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));
  gl.attachShader(program,shader);gl.deleteShader(shader);
 }
 gl.linkProgram(program);
 if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
 return program;
}

export class Landscape {
 constructor(gl, onError) {
  this.gl=gl;this.ready=false;
  this.program=compileProgram(gl,vertex,fragment);
  this.uniforms=Object.fromEntries(['skyMap','landscapeMap','noiseMap','viewRect','hour','drift','coverage','ready','enabled'].map(n=>[n,gl.getUniformLocation(this.program,n)]));
  this.framebuffer=gl.createFramebuffer();
  this.sky=gl.createTexture();gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.sky);
  this.configureTexture();
  this.photo=gl.createTexture();gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,this.photo);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,0,255,255]));
  this.configureTexture();
  const image=new Image();image.src='/assets/empty-site-keyed.png';
  image.onload=()=>{
   if(gl.isContextLost())return;
   gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,this.photo);
   gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
   gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
   gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
   this.ready=true;document.querySelector('#sky').dataset.landscape='ready';
  };
  image.onerror=()=>onError('The landscape artwork could not load. Please reload the page.');
 }
 configureTexture(){const gl=this.gl;for(const p of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,p,gl.LINEAR);for(const p of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,p,gl.CLAMP_TO_EDGE);}
 resize(w,h){
  this.width=w;this.height=h;const gl=this.gl;
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.sky);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  gl.bindFramebuffer(gl.FRAMEBUFFER,this.framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.sky,0);
  if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Unable to create sky render target.');
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);
 }
 beginSky(){const gl=this.gl;gl.bindFramebuffer(gl.FRAMEBUFFER,this.framebuffer);gl.viewport(0,0,this.width,this.height);}
 draw(state,rect,w,h){
  const gl=this.gl,u=this.uniforms;gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,w,h);gl.useProgram(this.program);
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.sky);gl.uniform1i(u.skyMap,1);
  gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,this.photo);gl.uniform1i(u.landscapeMap,2);gl.uniform1i(u.noiseMap,0);
  gl.uniform4fv(u.viewRect,rect);gl.uniform1f(u.hour,(state.hour%24+24)%24);gl.uniform1f(u.drift,state.drift);gl.uniform1f(u.coverage,state.cover);
  gl.uniform1f(u.ready,this.ready?1:0);gl.uniform1f(u.enabled,state.scene==='landscape'?1:0);
  gl.drawArrays(gl.TRIANGLES,0,3);
 }
}
