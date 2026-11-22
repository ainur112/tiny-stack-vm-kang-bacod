const fs = process.getBuiltinModule('fs'), path = process.getBuiltinModule('path');
const IN_DIR = process.env.MAKEFUN_INPUT_DIR || '/input';
const OUT_DIR = process.env.MAKEFUN_OUTPUT_DIR || '/output';
const valid = new Uint8Array(256), pops = new Uint8Array(256), pushes = new Uint8Array(256), imms = new Uint8Array(256);
for (const o of [0,1,2,3,4,5,6,7,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,32,33,34,48,49,50,51,52,64,65,80,81,82,83]) valid[o] = 1;
imms[1] = 1; imms[2] = 4; imms[48] = 2; imms[49] = 2; imms[50] = 2; imms[51] = 2;
pops[3]=1; pops[4]=1; pops[5]=2; pops[6]=2; pops[7]=3;
for (let o=16;o<=22;o++){pops[o]=2;pushes[o]=1;}
pops[23]=1; pushes[23]=1;
for (let o=24;o<=30;o++){pops[o]=2;pushes[o]=1;}
pops[27]=1;
pops[32]=2; pops[33]=2; pops[34]=2; pushes[32]=1; pushes[33]=1; pushes[34]=1;
pops[49]=1; pops[50]=1; pops[64]=1; pushes[64]=1; pops[65]=2;
pops[80]=1; pops[81]=1; pops[83]=1;
pushes[1]=1; pushes[2]=1; pushes[4]=2; pushes[5]=2; pushes[6]=3; pushes[7]=3; pushes[82]=1;
function execute(program, input){
  const n = program.length, stack = new Int32Array(256), calls = new Int32Array(64);
  const mem = new Int32Array(256), out = new Uint8Array(65536);
  let sp=0, csp=0, olen=0, ip=0, pc=0, steps=0, code=0;
  L: for(;;){
    if(steps===1000000){code=10;break L;}
    if(pc<0||pc>=n){code=9;break L;}
    const op=program[pc], m=imms[op];
    if(!valid[op]){code=5;break L;}
    if(pc+m>=n){code=9;break L;}
    steps++;
    const nx=pc+1+m;
    if(sp<pops[op]){code=2;break L;}
    if(sp-pops[op]+pushes[op]>256){code=3;break L;}
    pc=nx;
    switch(op){
      case 0: code=0; break L;
      case 1: stack[sp++]=(program[nx-1]<<24)>>24; break;
      case 2: stack[sp++]=program[nx-4]|program[nx-3]<<8|program[nx-2]<<16|program[nx-1]<<24; break;
      case 3: sp--; break;
      case 4: stack[sp]=stack[sp-1]; sp++; break;
      case 5: {const t=stack[sp-1];stack[sp-1]=stack[sp-2];stack[sp-2]=t;break;}
      case 6: stack[sp]=stack[sp-2]; sp++; break;
      case 7: {const a=stack[sp-3];stack[sp-3]=stack[sp-2];stack[sp-2]=stack[sp-1];stack[sp-1]=a;break;}
      case 23: stack[sp-1]=-stack[sp-1]|0; break;
      case 27: stack[sp-1]=~stack[sp-1]; break;
      case 16: case 17: case 18: case 19: case 20: case 21: case 22:
      case 24: case 25: case 26: case 28: case 29: case 30:
      case 32: case 33: case 34: {
        const b=stack[sp-1], a=stack[sp-2]; let r=0;
        if(op===16)r=(a+b)|0;
        else if(op===17)r=(a-b)|0;
        else if(op===18)r=Math.imul(a,b);
        else if(op===19){if(b===0){code=4;break L;}r=(a===-2147483648&&b===-1)?a:(a/b)|0;}
        else if(op===20){if(b===0){code=4;break L;}r=b===-1?0:a%b|0;}
        else if(op===21){if(b===0){code=4;break L;}r=Math.floor((a>>>0)/(b>>>0))|0;}
        else if(op===22){if(b===0){code=4;break L;}r=(a>>>0)%(b>>>0)|0;}
        else if(op===24)r=a&b;
        else if(op===25)r=a|b;
        else if(op===26)r=a^b;
        else if(op===28)r=a<<(b&31);
        else if(op===29)r=a>>(b&31);
        else if(op===30)r=(a>>>(b&31))|0;
        else if(op===32)r=a===b?1:0;
        else if(op===33)r=a<b?1:0;
        else r=(a>>>0)<(b>>>0)?1:0;
        sp-=2; stack[sp++]=r; break;
      }
      case 48: case 49: case 50: {
        const rel=(program[nx-2]|program[nx-1]<<8)<<16>>16;
        let take=true;
        if(op!==48){const v=stack[--sp];take=op===49?v===0:v!==0;}
        if(take)pc=nx+rel;
        break;
      }
      case 51: if(csp===64){code=7;break L;} calls[csp++]=nx; pc=program[nx-2]|program[nx-1]<<8; break;
      case 52: if(csp===0){code=8;break L;} pc=calls[--csp]; break;
      case 64: {const a=stack[sp-1];if(a<0||a>255){code=6;break L;}stack[sp-1]=mem[a];break;}
      case 65: {const a=stack[sp-1],v=stack[sp-2];if(a<0||a>255){code=6;break L;}sp-=2;mem[a]=v;break;}
      case 80: {const s=''+stack[sp-1];if(olen+s.length>65536){code=11;break L;}sp--;for(let i=0;i<s.length;i++)out[olen++]=s.charCodeAt(i);break;}
      case 81: if(olen+1>65536){code=11;break L;} out[olen++]=stack[--sp]&255; break;
      case 82: stack[sp++]=ip<input.length?input[ip++]:-1; break;
      case 83: code=stack[--sp]&255; break L;
    }
  }
  return {stdout:out.subarray(0,olen),exit:code};
}
for(const id of fs.readdirSync(IN_DIR).sort()){
  fs.mkdirSync(path.join(OUT_DIR,id),{recursive:true});
  const program=fs.readFileSync(path.join(IN_DIR,id,'program.bin'));
  const input=fs.readFileSync(path.join(IN_DIR,id,'input.bin'));
  const r=execute(program,input);
  fs.writeFileSync(path.join(OUT_DIR,id,'stdout.bin'),r.stdout);
  fs.writeFileSync(path.join(OUT_DIR,id,'exit.txt'),''+r.exit+'\n');
}
