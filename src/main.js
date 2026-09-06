import './style.css';
import {vertex, fragment} from './shaders.js';
import {createNoiseVolume} from './noise.js';
import {Landscape} from './landscape.js';

const canvas = document.querySelector('#sky');
const clock = document.querySelector('#clock');
const timeSlider = document.querySelector('#time');
const play = document.querySelector('#play');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const state = {scene:'landscape', hour:14, target:14, playing:!reducedMotion, cover:.55, wind:.5, drift:0, quality:matchMedia('(pointer: coarse)').matches?'low':'balanced'};
const wrap = n => (n % 24 + 24) % 24;
function updateUI() {
  const h = wrap(state.hour), totalMinutes = Math.round(h*60)%1440, hours = Math.floor(totalMinutes/60), minutes = totalMinutes%60;
  clock.innerHTML = `${hours%12 || 12}:${String(minutes).padStart(2,'0')} <small>${hours<12?'am':'pm'}</small>`;
  clock.dateTime = `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}`;
  timeSlider.value = h;
  document.querySelector('#period').textContent = h<5 || h>=21?'Under the same stars.':h<8?'A day, beginning.':h<12?'The morning opens up.':h<17?'The afternoon, unhurried.':h<20?'Stay for the last light.':'Between the day and the dark.';
  for (const b of document.querySelectorAll('[data-hour]')) b.classList.toggle('active',Math.abs(((h-Number(b.dataset.hour)+36)%24)-12)<1.3);
  play.textContent=state.playing?'Ⅱ':'▷';
  play.setAttribute('aria-label',state.playing?'Pause time':'Play time');
  play.title=state.playing?'Pause time':'Play time';
}
function setTime(value, immediate=false) {
  const delta=((wrap(value)-wrap(state.target)+36)%24)-12;
  state.target+=delta;
  if(immediate){state.drift+=(state.target-state.hour)*1.8;state.hour=state.target;}
  updateUI();
}
play.addEventListener('click',()=>{state.playing=!state.playing;updateUI();});
for(const button of document.querySelectorAll('[data-hour]')) button.addEventListener('click',()=>setTime(Number(button.dataset.hour)));
timeSlider.addEventListener('input',()=>setTime(Number(timeSlider.value),true));
let drag=null;
canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag={id:e.pointerId,x:e.clientX,hour:state.target};canvas.setPointerCapture(e.pointerId);canvas.focus({preventScroll:true});});
canvas.addEventListener('pointermove',e=>{if(drag&&e.pointerId===drag.id){state.target=drag.hour+(e.clientX-drag.x)/canvas.clientWidth*12;}});
for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,()=>drag=null);
canvas.addEventListener('wheel',e=>{e.preventDefault();state.target+=(Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY)*.006;},{passive:false});
window.addEventListener('keydown',e=>{
  if(e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLButtonElement)return;
  if(e.code==='ArrowRight'||e.code==='ArrowLeft'){e.preventDefault();state.target+=(e.code==='ArrowRight'?1:-1)*(e.shiftKey?1:.25);}
  if(e.code==='Space'){e.preventDefault();state.playing=!state.playing;updateUI();}
  if(e.code==='Escape'){document.querySelector('#settings').hidden=true;document.querySelector('#settings-toggle').setAttribute('aria-expanded','false');}
});
const settingsToggle=document.querySelector('#settings-toggle');
settingsToggle.addEventListener('click',()=>{const panel=document.querySelector('#settings');panel.hidden=!panel.hidden;settingsToggle.setAttribute('aria-expanded',String(!panel.hidden));});
document.querySelector('#cover').addEventListener('input',e=>{state.cover=Number(e.target.value);document.querySelector('#cover-value').value=`${Math.round(state.cover*100)}%`;});
document.querySelector('#wind').addEventListener('input',e=>{state.wind=Number(e.target.value);document.querySelector('#wind-value').value=state.wind===0?'Still':state.wind<.8?'Gentle':state.wind<1.5?'Breezy':'Brisk';});
document.querySelector('#quality').value=state.quality;
document.querySelector('#quality').addEventListener('change',e=>{state.quality=e.target.value;resize();});
let gl, program, uniforms, animationId, landscape, house;
let construction=.65,followTime=true;
const buildSlider=document.querySelector('#construction');
const follow=document.querySelector('#follow-time');
buildSlider.addEventListener('input',()=>{construction=Number(buildSlider.value);followTime=false;follow.checked=false;});
follow.addEventListener('change',()=>{followTime=follow.checked;});
function constructionProgress(){
 if(followTime){const h=wrap(state.hour);construction=h<5?1:Math.max(0,Math.min(1,(h-7)/11));}
 return construction;
}
const about=document.querySelector('#about');
document.querySelector('#about-open').addEventListener('click',()=>about.showModal());
document.querySelector('#about-close').addEventListener('click',()=>about.close());
let viewRect=new Float32Array([0,0,1,1]);
document.querySelector('#scene').addEventListener('change',e=>{state.scene=e.target.value;resize();});
function showError(message){const box=document.querySelector('#error');box.textContent=message;box.hidden=false;}
function resize(){
 const quality={low:.45,balanced:.65,high:.9}[state.quality];
 const scale=Math.min(devicePixelRatio,1.5)*quality;
 const cap=state.quality==='high'?1800:1200;
 const ratio=Math.min(scale,cap/innerWidth);
 const displayScale=Math.min(devicePixelRatio,2,2560/innerWidth);
 canvas.width=Math.round(innerWidth*displayScale);canvas.height=Math.round(innerHeight*displayScale);
 const aspect=innerWidth/innerHeight;
 const rw=Math.min(1,aspect/2),rh=Math.min(1,2/aspect);
 viewRect=new Float32Array([Math.min(1-rw,Math.max(0,.65-rw/2)),(1-rh)*.5,rw,rh]);
 if(landscape)landscape.resize(Math.max(1,Math.round(innerWidth*ratio)),Math.max(1,Math.round(innerHeight*ratio)));
 if(gl)gl.viewport(0,0,canvas.width,canvas.height);
 if(house)house.resize(viewRect,innerWidth,innerHeight);
}
function setup(){
 gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:false,powerPreference:'high-performance'});
 if(!gl)throw new Error('This sky needs WebGL 2. Try a current browser with hardware acceleration enabled.');
 const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));return shader;};
 program=gl.createProgram();
 const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment);
 gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
 if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
 gl.deleteShader(vs);gl.deleteShader(fs);gl.useProgram(program);
 gl.bindVertexArray(gl.createVertexArray());
 uniforms=Object.fromEntries(['resolution','hour','drift','coverage','steps','noiseMap','viewRect','landscapeEnabled'].map(n=>[n,gl.getUniformLocation(program,n)]));
 const {data,size}=createNoiseVolume();
 const texture=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_3D,texture);
 gl.texImage3D(gl.TEXTURE_3D,0,gl.RG8,size,size,size,0,gl.RG,gl.UNSIGNED_BYTE,data);
 gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
 for(const p of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T,gl.TEXTURE_WRAP_R])gl.texParameteri(gl.TEXTURE_3D,p,gl.REPEAT);
 gl.uniform1i(uniforms.noiseMap,0);landscape=new Landscape(gl,showError);resize();
 document.querySelector('#error').hidden=true;
 canvas.dataset.renderer='webgl2';
}
let last=performance.now(),uiAt=0;
function frame(now){
 const dt=Math.min((now-last)/1000,.08);last=now;
 if(!document.hidden){
  if(state.playing&&!drag)state.target+=dt*.012;
  const oldHour=state.hour;
  state.hour+=(state.target-state.hour)*(1-Math.exp(-dt*9));
  if(Math.abs(state.target-state.hour)<.0005)state.hour=state.target;
  // Clock changes move the weather forward or backward as well as the sun.
  state.drift+=(state.hour-oldHour)*1.8+(state.playing?dt*state.wind*.12:0);
  landscape.beginSky();gl.useProgram(program);
  gl.uniform2f(uniforms.resolution,landscape.width,landscape.height);
  gl.uniform4fv(uniforms.viewRect,viewRect);gl.uniform1f(uniforms.landscapeEnabled,state.scene==='landscape'?1:0);
  gl.uniform1f(uniforms.hour,wrap(state.hour));gl.uniform1f(uniforms.drift,state.drift);
  gl.uniform1f(uniforms.coverage,state.cover);gl.uniform1i(uniforms.steps,{low:36,balanced:56,high:88}[state.quality]);
  gl.drawArrays(gl.TRIANGLES,0,3);
  landscape.draw(state,viewRect,canvas.width,canvas.height);
  const progress=constructionProgress();
  if(house){try{house.draw(state,progress);}catch(error){console.error("House draw failed: "+String(error)+" "+error?.stack);house=null;}}
  buildSlider.value=progress;
  document.querySelector('#build-stage').textContent=progress<2/11?'The site':progress<3.5/11?'Rear wall raised':progress<5/11?'Left wall raised':progress<6.5/11?'Right wall raised':progress<8/11?'Front wall raised':progress<10/11?'Roof frames arriving':'Open frame complete';
  document.querySelector('#build-value').textContent=`${Math.round(progress*100)}%`;
  if(now-uiAt>100){updateUI();uiAt=now;}
 }
 animationId=requestAnimationFrame(frame);
}
window.addEventListener('resize',resize);
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();cancelAnimationFrame(animationId);showError('The sky renderer was interrupted. Waiting for your browser to restore it…');});
canvas.addEventListener('webglcontextrestored',()=>{try{setup();last=performance.now();animationId=requestAnimationFrame(frame);}catch(error){showError(error.message);}});
updateUI();
try{setup();animationId=requestAnimationFrame(frame);}catch(error){console.error(error);showError(error.message);}

import('./house.js').then(({HouseStudy})=>new HouseStudy().init()).then(result=>{house=result;house.resize(viewRect,innerWidth,innerHeight);}).catch(error=>{console.error(error);document.querySelector('#build-stage').textContent='3D frame unavailable';document.querySelector('#construction-panel').title='The 3D renderer could not initialize. The sky and landscape are still available.';});
