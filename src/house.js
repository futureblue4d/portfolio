import * as THREE from 'three/webgpu';

// A small true 3D timber model. An affine camera is calibrated to the four
// corners of the photographed pad; the image remains a fixed-view backdrop.
export class HouseStudy {
 async init() {
  this.canvas=document.createElement('canvas');this.canvas.id='house';this.canvas.setAttribute('aria-hidden','true');
  document.querySelector('#sky').after(this.canvas);
  this.renderer=new THREE.WebGPURenderer({canvas:this.canvas,alpha:true,antialias:true,forceWebGL:new URLSearchParams(location.search).has("webgl")});
  this.renderer.setClearColor(0x000000,0);
  await this.renderer.init();
  this.canvas.dataset.backend=this.renderer.backend.isWebGPUBackend?'webgpu':'webgl2';
  this.scene=new THREE.Scene();this.camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,100);this.camera.matrixAutoUpdate=false;
  this.camera.coordinateSystem=this.renderer.backend.isWebGPUBackend?THREE.WebGPUCoordinateSystem:THREE.WebGLCoordinateSystem;
  this.camera.matrixWorld.identity();this.camera.matrixWorldInverse.identity();
  this.ambient=new THREE.HemisphereLight(0xd9e8ff,0x66503c,2.2);this.scene.add(this.ambient);
  this.sun=new THREE.DirectionalLight(0xffe5bb,2.5);this.sun.position.set(-7,9,5);this.scene.add(this.sun);
  this.material=new THREE.MeshStandardMaterial({color:0xc6a377,roughness:.87,metalness:0});
  this.members=[];this.geometry=new THREE.BoxGeometry(1,1,1);
  const beam=(a,b,width,start,duration=.11)=>{
   const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),delta=to.clone().sub(from);
   const mesh=new THREE.Mesh(this.geometry,this.material);
   mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.clone().normalize());
   mesh.frustumCulled=false;this.scene.add(mesh);this.members.push({mesh,from,delta,width,start,duration});
  };
  // Sill plates, wall studs, headers, top plates and exposed gable rafters.
  beam([0,0,0],[10,0,0],.15,.02);beam([0,0,7],[10,0,7],.15,.04);
  beam([0,0,0],[0,0,7],.15,.06);beam([10,0,0],[10,0,7],.15,.08);
  for(let x=0;x<=10;x+=1.25){
   beam([x,0,7],[x,3,7],.12,.17+x*.014);
   if(x<1.5||x>8.5)beam([x,0,0],[x,3,0],.14,.22+x*.014);
  }
  for(let z=1.4;z<7;z+=1.4){beam([0,0,z],[0,3,z],.12,.25+z*.02);beam([10,0,z],[10,3,z],.12,.28+z*.02);}
  beam([1.25,2.55,0],[8.75,2.55,0],.22,.47);
  beam([0,3,0],[10,3,0],.18,.52);beam([0,3,7],[10,3,7],.18,.54);
  beam([0,3,0],[0,3,7],.18,.56);beam([10,3,0],[10,3,7],.18,.58);
  for(let z=0;z<=7.01;z+=1.4){
   beam([0,3,z],[5,4.7,z],.14,.64+z*.025);
   beam([10,3,z],[5,4.7,z],.14,.67+z*.025);
   if(z===0||z>6.9)beam([5,3,z],[5,4.7,z],.12,.76);
  }
  beam([5,4.7,0],[5,4.7,7],.20,.88,.12);
  this.ready=true;return this;
 }
 resize(rect,w,h) {
  if(!this.ready)return;
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.setSize(w,h,false);
  const [ox,oy,rw,rh]=rect;
  // Image coordinates use bottom-left origin, matching the landscape shader.
  this.camera.projectionMatrix.set(
   2*.01178/rw,0,2*-.00443/rw,2*(.6426-ox)/rw-1,
   2*.001465/rh,2*.026/rh,2*.00306/rh,2*(.2525-oy)/rh-1,
   -.006,-.012,.009,.5,
   0,0,0,1
  );
  this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
 }
 draw(state,progress){
  if(!this.ready)return;
  this.canvas.hidden=state.scene!=='landscape';if(this.canvas.hidden)return;
  for(const member of this.members){
   let t=THREE.MathUtils.clamp((progress-member.start)/member.duration,0,1);t=t*t*(3-2*t);
   member.mesh.visible=t>.001;
   member.mesh.scale.set(member.width,member.delta.length()*t,member.width);
   member.mesh.position.copy(member.from).addScaledVector(member.delta,t*.5);
  }
  const angle=(state.hour-6)/24*Math.PI*2;
  const day=THREE.MathUtils.smoothstep(Math.sin(angle),-.16,.22);
  const warm=Math.exp(-Math.pow((Math.sin(angle)-.08)/.26,2));
  this.ambient.intensity=.09+day*1.6;
  this.ambient.color.setRGB(.57+day*.28,.69+day*.2,1);
  this.sun.intensity=day*(1.2+Math.max(0,Math.sin(angle)));
  this.sun.color.setRGB(1,1-warm*.38,1-warm*.65);
  this.sun.position.set(Math.cos(angle)*12,Math.sin(angle)*12,8);
  this.renderer.render(this.scene,this.camera);
  this.canvas.dataset.progress=progress.toFixed(3);
  this.canvas.dataset.members=String(this.members.filter(m=>m.mesh.visible).length);
 }
}
