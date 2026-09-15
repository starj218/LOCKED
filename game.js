import * as THREE from "three";

import {
    PointerLockControls
} from "three/addons/controls/PointerLockControls.js";

import {
    GLTFLoader
} from "three/addons/loaders/GLTFLoader.js";


// ========================================
// 기본 설정
// ========================================

const game = document.getElementById("game");

const startMessage =
    document.getElementById("startMessage");


// ========================================
// 3D 장면
// ========================================

const scene = new THREE.Scene();

scene.background =
    new THREE.Color(0x202020);


// ========================================
// 카메라
// ========================================

const camera =
    new THREE.PerspectiveCamera(
        75,
        window.innerWidth /
        window.innerHeight,
        0.1,
        1000
    );


// 플레이어 눈높이
camera.position.set(
    0,
    1.7,
    5
);


// ========================================
// 렌더러
// ========================================

const renderer =
    new THREE.WebGLRenderer({
        antialias: true
    });

renderer.setSize(
    window.innerWidth,
    window.innerHeight
);

renderer.setPixelRatio(
    Math.min(
        window.devicePixelRatio,
        2
    )
);

game.appendChild(
    renderer.domElement
);


// ========================================
// 조명
// ========================================

const ambientLight =
    new THREE.AmbientLight(
        0xffffff,
        1.2
    );

scene.add(
    ambientLight
);


const roomLight =
    new THREE.PointLight(
        0xffffff,
        30,
        30
    );

roomLight.position.set(
    0,
    3.5,
    0
);

scene.add(
    roomLight
);

// ========================================
// 3D 방 모델 불러오기
// ========================================

const loader = new GLTFLoader();

loader.load(
    "models/room.glb",

    (gltf) => {

        const room = gltf.scene;

        // 방 크기
        room.scale.set(
            1,
            1,
            1
        );

        // 방 위치
        room.position.set(
            0,
            0,
            0
        );

        scene.add(room);

        console.log(
            "방 모델 불러오기 완료!"
        );

    },

    undefined,

    (error) => {

        console.error(
            "방 모델을 불러오지 못했습니다.",
            error
        );

    }
);


// ========================================
// 1인칭 조작
// ========================================

const controls =
    new PointerLockControls(
        camera,
        document.body
    );


// 화면 클릭
document.addEventListener(
    "click",
    () => {

        controls.lock();

    }
);


// 마우스 잠금 상태 변경
controls.addEventListener(
    "lock",
    () => {

        startMessage.style.display =
            "none";

    }
);


controls.addEventListener(
    "unlock",
    () => {

        startMessage.style.display =
            "block";

    }
);


// ========================================
// 키 입력
// ========================================

const keys = {};


// 키를 누름
document.addEventListener(
    "keydown",
    (event) => {

        keys[
            event.key.toLowerCase()
        ] = true;

    }
);


// 키를 뗌
document.addEventListener(
    "keyup",
    (event) => {

        keys[
            event.key.toLowerCase()
        ] = false;

    }
);


// ========================================
// 플레이어 이동
// ========================================

const speed = 4;

const clock =
    new THREE.Clock();


function movePlayer(delta) {

    let forward = 0;
    let right = 0;


    // 앞으로
    if (keys["w"]) {

        forward += 1;

    }


    // 뒤로
    if (keys["s"]) {

        forward -= 1;

    }


    // 왼쪽
    if (keys["a"]) {

        right -= 1;

    }


    // 오른쪽
    if (keys["d"]) {

        right += 1;

    }


    // 대각선 속도 보정
    if (
        forward !== 0 &&
        right !== 0
    ) {

        const length =
            Math.sqrt(
                forward * forward +
                right * right
            );

        forward /= length;
        right /= length;

    }


    const moveSpeed =
        speed * delta;


    // 앞뒤 이동
    if (forward !== 0) {

        controls.moveForward(
            forward * moveSpeed
        );

    }


    // 좌우 이동
    if (right !== 0) {

        controls.moveRight(
            right * moveSpeed
        );

    }


    // 플레이어가 방 밖으로 나가지 않게
    camera.position.x =
        THREE.MathUtils.clamp(
            camera.position.x,
            -9,
            9
        );


    camera.position.z =
        THREE.MathUtils.clamp(
            camera.position.z,
            -9,
            9
        );

}


// ========================================
// 화면 크기 변경
// ========================================

window.addEventListener(
    "resize",
    () => {

        camera.aspect =
            window.innerWidth /
            window.innerHeight;

        camera.updateProjectionMatrix();


        renderer.setSize(
            window.innerWidth,
            window.innerHeight
        );

    }
);


// ========================================
// 게임 루프
// ========================================

function gameLoop() {

    const delta =
        Math.min(
            clock.getDelta(),
            0.05
        );


    if (controls.isLocked) {

        movePlayer(delta);

    }


    renderer.render(
        scene,
        camera
    );


    requestAnimationFrame(
        gameLoop
    );

}


gameLoop();
