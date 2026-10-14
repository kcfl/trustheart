import fs from 'node:fs';

const buf = fs.readFileSync('public/heart.glb');
const magic = buf.toString('utf8', 0, 4);
const version = buf.readUInt32LE(4);
const length = buf.readUInt32LE(8);
const chunkLength = buf.readUInt32LE(12);
const chunkType = buf.toString('utf8', 16, 20);

console.log(`GLB Magic: ${magic}, Version: ${version}, Total Length: ${length}`);
console.log(`Chunk 0: Type=${chunkType}, Length=${chunkLength}`);

const jsonStr = buf.toString('utf8', 20, 20 + chunkLength);
const gltf = JSON.parse(jsonStr);

console.log('\n--- GLTF Summary ---');
console.log('Meshes:', gltf.meshes?.length ?? 0);
console.log('Nodes:', gltf.nodes?.length ?? 0);
console.log('Accessors:', gltf.accessors?.length ?? 0);

console.log('\n--- All Nodes ---');
if (gltf.nodes) {
  gltf.nodes.forEach((node, i) => {
    console.log(`Node [${i}] name: "${node.name}" mesh: ${node.mesh !== undefined ? node.mesh : 'none'}`);
  });
}

console.log('\n--- All Meshes & Primitives ---');
if (gltf.meshes) {
  gltf.meshes.forEach((mesh, i) => {
    console.log(`Mesh [${i}] name: "${mesh.name}" primitives: ${mesh.primitives?.length}`);
    mesh.primitives?.forEach((prim, pi) => {
      const posAcc = gltf.accessors?.[prim.attributes?.POSITION];
      console.log(`  Primitive [${pi}]: Material=${prim.material}, POS min=[${posAcc?.min}], max=[${posAcc?.max}]`);
    });
  });
}
