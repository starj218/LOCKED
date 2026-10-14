(() => {
"use strict";

const $ = id => document.getElementById(id);
const startScreen=$("startScreen"), startButton=$("startButton");
const dialog=$("dialog"), dialogTitle=$("dialogTitle"), dialogText=$("dialogText");
const dialogActions=$("dialogActions"), dialogEyebrow=$("dialogEyebrow");
const closeDialog=$("closeDialog"), prompt=$("interactPrompt"), message=$("message");
const objective=$("objective"), winScreen=$("winScreen"), restartButton=$("restartButton");

let canvas, gl, program, buffer, colorLoc, matrixLoc;
let started=false, dialogOpen=false, won=false, pointerLocked=false, last=0;
let yaw=0, pitch=0, vy=0, grounded=true, msgTimer=0;
const keys=new Set();
const player={x:0,z:4.2,y:1.65,r:.34,speed:4.8,jump:6.4,gravity:17};
const objects=[], colliders=[], boxes=[];
const progress={note:false,locker:false,power:false,computer:false,exit:false};
let nearby=null;

const VS=`attribute vec3 aPosition; uniform mat4 uMatrix; void main(){gl_Position=uMatrix*vec4(aPosition,1.0);}`;
const FS=`precision mediump float; uniform vec4 uColor; void main(){gl_FragColor=uColor;}`;

function shader(type,src){
 const s=gl.createShader(type); gl.shaderSource(s,src); gl.compileShader(s);
 if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
 return s;
}
function initGL(){
 canvas=document.createElement("canvas"); canvas.id="webglCanvas";
 canvas.style.cssText="position:fixed;inset:0;width:100%;height:100%;z-index:0;display:block;background:#111d29";
 $("game").prepend(canvas);
 gl=canvas.getContext("webgl",{antialias:true});
 if(!gl) throw new Error("WebGL을 지원하지 않는 브라우저입니다.");
 program=gl.createProgram();
 gl.attachShader(program,shader(gl.VERTEX_SHADER,VS));
 gl.attachShader(program,shader(gl.FRAGMENT_SHADER,FS));
 gl.linkProgram(program);
 if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error("WebGL shader link failed");
 gl.useProgram(program);
 colorLoc=gl.getUniformLocation(program,"uColor");
 matrixLoc=gl.getUniformLocation(program,"uMatrix");

 const v=[
 -1,-1,-1, 1,-1,-1, 1,1,-1, -1,1,-1,
 -1,-1,1, 1,-1,1, 1,1,1, -1,1,1
 ];
 const idx=[0,1,2,0,2,3, 1,5,6,1,6,2, 5,4,7,5,7,6,
            4,0,3,4,3,7, 3,2,6,3,6,7, 4,5,1,4,1,0];
 const verts=[];
 for(const i of idx) verts.push(v[i*3],v[i*3+1],v[i*3+2]);

 buffer=gl.createBuffer();
 gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
 gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(verts),gl.STATIC_DRAW);
 const loc=gl.getAttribLocation(program,"aPosition");
 gl.enableVertexAttribArray(loc);
 gl.vertexAttribPointer(loc,3,gl.FLOAT,false,0,0);
 gl.enable(gl.DEPTH_TEST);
 gl.clearColor(.055,.09,.13,1);
 resize();
}
function resize(){
 if(!canvas)return;
 canvas.width=Math.floor(innerWidth*devicePixelRatio);
 canvas.height=Math.floor(innerHeight*devicePixelRatio);
 gl.viewport(0,0,canvas.width,canvas.height);
}
function perspective(fov,aspect,near,far){
 const f=1/Math.tan(fov/2), nf=1/(near-far);
 return [f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1,
         0,0,(2*far*near)*nf,0];
}
function mul(a,b){
 const o=new Array(16);
 for(let c=0;c<4;c++)for(let r=0;r<4;r++)
   o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];
 return o;
}
function translate(x,y,z){return [1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1];}
function rotateY(a){const c=Math.cos(a),s=Math.sin(a);return [c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1];}
function rotateX(a){const c=Math.cos(a),s=Math.sin(a);return [1,0,0,0,0,c,s,0,0,-s,c,0,0,0,0,1];}
function scale(x,y,z){return [x,0,0,0,0,y,0,0,0,0,z,0,0,0,0,1];}

function renderBox(x,y,z,sx,sy,sz,color,rot=0){
 let model=mul(rotateY(rot),scale(sx,sy,sz));
 model=mul(translate(x,y,z),model);
 let view=mul(rotateX(-pitch),rotateY(-yaw));
 view=mul(view,translate(-player.x,-player.y,-player.z));
 const mat=mul(mul(perspective(Math.PI/3,canvas.width/canvas.height,.05,100),view),model);
 gl.uniformMatrix4fv(matrixLoc,false,new Float32Array(mat));
 gl.uniform4f(colorLoc,color[0],color[1],color[2],1);
 gl.drawArrays(gl.TRIANGLES,0,36);
}
function addObj(id,label,x,y,z,range,action){objects.push({id,label,x,y,z,range,action});}
function B(x,y,z,sx,sy,sz,c,collide=true){
 const b={x,y,z,sx,sy,sz,color:c};
 boxes.push(b);
 if(collide)colliders.push({minX:x-sx,maxX:x+sx,minZ:z-sz,maxZ:z+sz});
 return b;
}

function build(){
 const C={
  floor:[.23,.28,.33],wall:[.38,.45,.50],dark:[.08,.13,.17],
  metal:[.55,.62,.65],wood:[.40,.30,.22],paper:[.88,.82,.66],
  cyan:[.18,.9,.82],red:[.9,.18,.15],screen:[.08,.5,.58]
 };

 B(0,-.15,0,9,.15,7,C.floor,false);
 B(0,2,7,9,2,.15,C.wall);
 B(-9,2,0,.15,2,7,C.wall);
 B(9,2,0,.15,2,7,C.wall);
 B(-5.85,2,-7,3.15,2,.15,C.wall);
 B(5.85,2,-7,3.15,2,.15,C.wall);
 B(0,3.4,-7,2.7,.6,.15,C.wall);

 B(0,1.62,-6.78,1.55,1.62,.11,C.dark,false);
 B(0,3.35,-6.76,1.8,.09,.2,C.metal,false);

 B(-5,.95,-.2,1.35,.08,.6,C.wood);
 B(-6.15,.47,-.65,.07,.47,.07,C.dark);
 B(-3.85,.47,-.65,.07,.47,.07,C.dark);
 B(-6.15,.47,.25,.07,.47,.07,C.dark);
 B(-3.85,.47,.25,.07,.47,.07,C.dark);
 B(-5,1.05,-.2,.28,.015,.19,C.paper,false);
 addObj("note","책상 위 메모",-5,1.15,-.2,2.6,showNote);

 B(-1.3,.93,-.4,.625,.925,.375,C.metal);
 B(-1.3,1.35,-.79,.06,.06,.03,C.red,false);
 addObj("locker","잠긴 보관함",-1.3,1,-1,2.4,showLocker);

 B(3.2,1.2,-.55,.625,.825,.11,C.dark);
 B(3.2,1.7,-.41,.09,.09,.04,C.red,false);
 B(3.2,1.2,-.38,.09,.18,.06,C.metal,false);
 addObj("switch","전원 스위치",3.2,1.2,-.1,2.5,showSwitch);

 B(4.9,.95,3.1,.825,.07,.425,C.wood);
 B(4.25,.47,2.8,.06,.47,.06,C.dark);
 B(5.55,.47,2.8,.06,.47,.06,C.dark);
 B(4.9,1.35,3,.475,.31,.06,C.dark,false);
 B(4.9,1.37,2.925,.39,.215,.018,C.screen,false);
 addObj("computer","컴퓨터",4.9,1.4,2.45,2.6,showComputer);

 B(6.9,.38,-2.5,.5,.38,.45,C.wood);
 B(2.05,1.35,-6.5,.21,.31,.07,C.dark,false);
 B(2.05,1.51,-6.405,.14,.08,.02,C.cyan,false);
 addObj("exit","잠긴 출구",0,1.4,-6.05,2.7,showExit);

 colliders.push(
  {minX:-9.4,maxX:-8.6,minZ:-7.2,maxZ:7.2},
  {minX:8.6,maxX:9.4,minZ:-7.2,maxZ:7.2},
  {minX:-9,maxX:-1.8,minZ:-7.4,maxZ:-6.6},
  {minX:1.8,maxX:9,minZ:-7.4,maxZ:-6.6},
  {minX:-9,maxX:9,minZ:6.6,maxZ:7.4}
 );
}

function showMsg(t,ms=2400){
 message.textContent=t;
 message.classList.add("visible");
 clearTimeout(msgTimer);
 msgTimer=setTimeout(()=>message.classList.remove("visible"),ms);
}
function openDialog(title,text,actions=[],ey="INTERACTION"){
 dialogTitle.textContent=title;
 dialogText.textContent=text;
 dialogEyebrow.textContent=ey;
 dialogActions.replaceChildren(...actions);
 dialog.classList.remove("hidden");
 dialogOpen=true;
 if(pointerLocked)document.exitPointerLock();
}
function closeD(){dialog.classList.add("hidden");dialogOpen=false;}
function btn(t,fn,secondary=false){
 const b=document.createElement("button");
 b.textContent=t;
 if(secondary)b.className="secondary-button";
 b.onclick=fn;
 return b;
}
function codeForm(correct){
 const input=document.createElement("input");
 input.maxLength=4;
 input.inputMode="numeric";
 input.placeholder="4자리 코드";
 const b=btn("확인",()=>{
  if(input.value.trim()===correct){
   if(correct==="2580"){
    progress.locker=true;
    closeD();
    showMsg("보관함이 열렸다! 전원 안내문을 찾았다.");
    updateObjective();
   }else{
    progress.exit=true;
    closeD();
    won=true;
    objective.textContent="목표 완료: 탈출 성공!";
    showMsg("출구 잠금이 해제되었다!",3000);
    setTimeout(()=>winScreen.classList.remove("hidden"),600);
   }
  }else showMsg("번호가 맞지 않는다. 단서를 다시 확인해 보자.");
 });
 input.onkeydown=e=>{if(e.key==="Enter")b.click()};
 setTimeout(()=>input.focus(),0);
 return [input,b];
}
function showNote(){
 progress.note=true;
 openDialog("책상 위 메모",
  "연구실 번호: 2580\n\n메모 아래에는 작은 글씨가 적혀 있다.\n'보관함의 번호로 사용하라.'",
  [btn("확인",closeD)],"CLUE 01");
 updateObjective();
}
function showLocker(){
 if(progress.locker){
  openDialog("보관함","이미 열려 있다.\n안내문: 전원 스위치를 켜야 컴퓨터가 작동한다.",
   [btn("확인",closeD)]);
  return;
 }
 openDialog("잠긴 보관함","4자리 비밀번호를 입력하세요.",codeForm("2580"),"LOCKER");
}
function showSwitch(){
 if(!progress.locker){
  openDialog("전원 스위치","스위치 옆에 적혀 있다.\n'보관함의 안내문을 먼저 확인하라.'",
   [btn("확인",closeD)]);
  return;
 }
 if(progress.power){
  openDialog("전원 스위치","전원은 이미 켜져 있다. 컴퓨터를 조사해 보자.",
   [btn("확인",closeD)]);
  return;
 }
 openDialog("전원 스위치","전원 스위치를 올릴까요?",
  [btn("전원 켜기",()=>{
    progress.power=true;
    closeD();
    updateObjective();
    showMsg("전원이 복구되었다. 컴퓨터 화면이 켜졌다!");
  }),btn("취소",closeD,true)]);
}
function showComputer(){
 if(!progress.power){
  openDialog("컴퓨터","화면이 꺼져 있다.\n먼저 전원 스위치를 켜야 한다.",
   [btn("확인",closeD)]);
  return;
 }
 progress.computer=true;
 openDialog("연구실 컴퓨터",
  "전원 복구 완료.\n\n최종 출구 코드: 7314\n\n출구의 암호 입력 장치에 이 번호를 입력하라.",
  [btn("확인",closeD)],"SYSTEM MESSAGE");
 updateObjective();
}
function showExit(){
 if(!progress.computer){
  openDialog("잠긴 출구","출구는 잠겨 있다.\n컴퓨터에서 최종 출구 코드를 확인해야 한다.",
   [btn("확인",closeD)]);
  return;
 }
 openDialog("출구 암호 장치","최종 탈출 코드 4자리를 입력하세요.",
  codeForm("7314"),"FINAL LOCK");
}
function updateObjective(){
 if(progress.exit)objective.textContent="목표 완료: 탈출 성공!";
 else if(progress.computer)objective.textContent="목표: 출구에 7314 입력";
 else if(progress.power)objective.textContent="목표: 컴퓨터에서 탈출 코드 확인";
 else if(progress.locker)objective.textContent="목표: 전원 스위치 켜기";
 else objective.textContent="목표: 메모를 찾아 보관함 열기";
}
function dist(o){return Math.hypot(player.x-o.x,player.z-o.z);}
function getNear(){
 let best=null,bd=Infinity;
 for(const o of objects){
  const d=dist(o);
  if(d<o.range&&d<bd){
   const dx=o.x-player.x,dz=o.z-player.z,len=Math.hypot(dx,dz)||1;
   const fx=-Math.sin(yaw),fz=-Math.cos(yaw);
   if((dx/len)*fx+(dz/len)*fz>-.15){best=o;bd=d;}
  }
 }
 return best;
}
function collide(x,z){
 const r=player.r;
 if(x<-8.5+r||x>8.5-r||z<-6.5+r||z>6.5-r){
  if(!(progress.exit&&Math.abs(x)<1.7&&z<-6))return true;
 }
 for(const c of colliders){
  const qx=Math.max(c.minX,Math.min(x,c.maxX));
  const qz=Math.max(c.minZ,Math.min(z,c.maxZ));
  const dx=x-qx,dz=z-qz;
  if(dx*dx+dz*dz<r*r)return true;
 }
 if(!progress.exit&&Math.abs(x)<1.7&&z<-6.35)return true;
 return false;
}
function move(dt){
 if(!started||dialogOpen||won)return;
 const f=(keys.has("KeyW")?1:0)-(keys.has("KeyS")?1:0);
 const s=(keys.has("KeyD")?1:0)-(keys.has("KeyA")?1:0);
 let mx=-Math.sin(yaw)*f+Math.cos(yaw)*s;
 let mz=-Math.cos(yaw)*f-Math.sin(yaw)*s;
 const l=Math.hypot(mx,mz);
 if(l){mx/=l;mz/=l;}
 const speed=player.speed*((keys.has("ShiftLeft")||keys.has("ShiftRight"))?1.3:1);
 const nx=player.x+mx*speed*dt,nz=player.z+mz*speed*dt;
 if(!collide(nx,player.z))player.x=nx;
 if(!collide(player.x,nz))player.z=nz;
 if(keys.has("Space")&&grounded){
  vy=player.jump;grounded=false;keys.delete("Space");
 }
 vy-=player.gravity*dt;
 player.y+=vy*dt;
 if(player.y<=1.65){player.y=1.65;vy=0;grounded=true;}
}
function updatePrompt(){
 nearby=getNear();
 if(!started||dialogOpen||won||!nearby){prompt.classList.add("hidden");return;}
 prompt.textContent=`[E] ${nearby.label}`;
 prompt.classList.remove("hidden");
}
function interact(){
 if(!started||dialogOpen||won)return;
 if(nearby)nearby.action();
 else showMsg("조사할 물건 가까이에서 E를 눌러 보자.");
}
function render(){
 gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 for(const b of boxes)renderBox(b.x,b.y,b.z,b.sx,b.sy,b.sz,b.color);
 renderBox(3.2,1.7,-.41,.09,.09,.04,progress.power?[.18,.9,.82]:[.9,.18,.15]);
 renderBox(-1.3,1.35,-.79,.06,.06,.03,progress.locker?[.18,.9,.82]:[.9,.18,.15]);
 renderBox(2.05,1.51,-6.405,.14,.08,.02,[.18,.9,.82]);
}
function loop(t){
 const dt=Math.min((t-last)/1000||0,.04);
 last=t;
 move(dt);
 updatePrompt();
 render();
 requestAnimationFrame(loop);
}

startButton.onclick=()=>{
 started=true;
 startScreen.classList.add("hidden");
 canvas.requestPointerLock?.();
 showMsg("연구실에 들어왔다. 책상 위 메모부터 조사하자.",3200);
};
closeDialog.onclick=closeD;
restartButton.onclick=()=>location.reload();

document.addEventListener("pointerlockchange",()=>pointerLocked=document.pointerLockElement===canvas);
document.addEventListener("mousemove",e=>{
 if(!pointerLocked||dialogOpen||!started)return;
 yaw-=e.movementX*.0022;
 pitch-=e.movementY*.0022;
 pitch=Math.max(-1.48,Math.min(1.48,pitch));
});
document.addEventListener("keydown",e=>{
 if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code))e.preventDefault();
 if(e.code==="Escape"&&dialogOpen){closeD();return;}
 if(e.code==="KeyE"&&!e.repeat){interact();return;}
 keys.add(e.code);
});
document.addEventListener("keyup",e=>keys.delete(e.code));
window.addEventListener("blur",()=>keys.clear());
window.addEventListener("resize",resize);

try{
 initGL();
 build();
 requestAnimationFrame(loop);
}catch(e){
 console.error(e);
 startButton.disabled=true;
 startButton.textContent="3D 초기화 실패";
 showMsg("3D 화면을 시작하지 못했습니다. 브라우저에서 WebGL을 사용할 수 있는지 확인해 주세요.",6000);
}
})();
