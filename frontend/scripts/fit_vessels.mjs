globalThis.self = globalThis;
import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Read glb into ArrayBuffer
const buffer = fs.readFileSync('public/heart.glb');
const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

const loader = new GLTFLoader();
loader.parse(
  arrayBuffer,
  '',
  (gltf) => {
    const scene = gltf.scene;
    let heartMesh = null;
    scene.traverse((child) => {
      if (child.isMesh) heartMesh = child;
    });

    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    console.log('Mesh found:', heartMesh ? heartMesh.name : 'none');
    console.log('Box min:', box.min);
    console.log('Box max:', box.max);
    console.log('Box size:', size);
    console.log('Box center:', center);

    // Test a raycast from anterior (+Z) towards the model to find surface Z
    const raycaster = new THREE.Raycaster();
    const ladPoints = [
      { u: 0.53, v: 0.68 },
      { u: 0.51, v: 0.60 },
      { u: 0.48, v: 0.50 },
      { u: 0.45, v: 0.38 },
      { u: 0.43, v: 0.26 },
      { u: 0.41, v: 0.16 },
      { u: 0.39, v: 0.08 },
    ];

    const lcxPoints = [
      { u: 0.53, v: 0.67 },
      { u: 0.59, v: 0.64 },
      { u: 0.67, v: 0.60 },
      { u: 0.74, v: 0.55 },
      { u: 0.78, v: 0.48 },
      { u: 0.76, v: 0.40 },
      { u: 0.70, v: 0.34 },
    ];

    const rcaPoints = [
      { u: 0.36, v: 0.70 },
      { u: 0.30, v: 0.62 },
      { u: 0.24, v: 0.52 },
      { u: 0.20, v: 0.42 },
      { u: 0.21, v: 0.32 },
      { u: 0.26, v: 0.22 },
      { u: 0.32, v: 0.15 },
    ];

    function tracePath(name, pts) {
      console.log(`\n// ${name} Points:`);
      const result = [];
      pts.forEach((p, idx) => {
        const x = box.min.x + p.u * size.x;
        const y = box.min.y + p.v * size.y;
        raycaster.set(new THREE.Vector3(x, y, 5), new THREE.Vector3(0, 0, -1));
        const hits = raycaster.intersectObject(heartMesh, true);
        if (hits.length > 0) {
          const hitZ = hits[0].point.z;
          const normW = Math.min(1.0, Math.max(0.0, (hitZ - box.min.z) / size.z));
          // add slight offset outward (+0.015) so tube sits comfortably on top of mesh
          const wOffset = Math.min(1.0, normW + 0.012);
          result.push({ u: p.u, v: p.v, w: Number(wOffset.toFixed(4)) });
        } else {
          console.log(`Warning: no hit for ${name}[${idx}] at u=${p.u}, v=${p.v}`);
        }
      });
      console.log(JSON.stringify(result, null, 2));
    }

    tracePath('LAD', ladPoints);
    tracePath('LCX', lcxPoints);
    tracePath('RCA', rcaPoints);

  },
  (err) => console.error(err)
);
