const fs = require('fs');
const s = fs.readFileSync('src/samples/mohui.ts', 'utf8');
const count = (re) => (s.match(re) || []).length;
console.log('mousemove-family listeners:', count(/addEventListener\(\s*['"](mousemove|mouseenter|mouseleave|mouseover|mouseout)['"]/g));
console.log('pointer-family listeners:', count(/addEventListener\(\s*['"](pointermove|pointerdown|pointerup|pointerenter|pointerleave)['"]/g));
console.log('new PointerEvent:', count(/new\s+PointerEvent/g));
console.log('new MouseEvent:', count(/new\s+MouseEvent/g));
console.log('scroll listeners:', count(/addEventListener\(\s*['"]scroll['"]/g));
console.log('wheel listeners:', count(/addEventListener\(\s*['"]wheel['"]/g));
