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
const startMessage = document.getElementById("startMessage");


// ========================================
// 3D 장면
// ========================================

const scene = new THREE.Scene();

scene.background = new THREE.Color(0x202020);


// ========================================
// 카메라
// ========================================

const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);

camera.position.set(
    0,
    1.7,
    5
);


// ========================================
// 렌더러
// ========================================

const renderer = new THREE.WebGLRenderer({
    antialias: true
});

renderer.setSize(
    window.innerWidth,
    window.innerHeight
);

renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, 2)
);

game.appendChild(
    renderer.domElement
);


// ========================================
// 조명
// ========================================

// 전체적으로 밝게
const ambientLight = new THREE.AmbientLight(
    0xffffff,
    2
);

scene.add(
    ambientLight
);


// 방 안을 비추는 빛
const roomLight = new THREE.PointLight(
    0xffffff,
    100,
    50
);

roomLight.position.set(
    0,
    5,
    0
);

scene.add(
    roomLight
);


// ========================================
// 임시 바닥
// ========================================

// 모델이 안 보이는 경우에도
// 플레이어가 어디에 있는지 확인하기 위한 바닥

const floorGeometry = new THREE.PlaneGeometry(
    50,
    50
);

const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x444444
});

const floor = new THREE.Mesh(
    floorGeometry,
    floorMaterial
);

floor.rotation.x = -Math.PI / 2;

floor.position.y = 0;

scene.add(
    floor
);


// ========================================
// 3D 방 모델 불러오기
// ========================================

const loader = new GLTFLoader();

loader.load(

    "models/room.glb",

    // ====================================
    // 성공
    // ====================================

    (gltf) => {

        const room = gltf.scene;


        console.log(
            "방 모델 불러오기 성공!"
        );


        // --------------------------------
        // 모델 크기 확인
        // --------------------------------

        const box = new THREE.Box3()
            .setFromObject(room);

        const size = new THREE.Vector3();

        box.getSize(size);


        console.log(
            "방 크기:",
            size.x,
            size.y,
            size.z
        );


        // --------------------------------
        // 모델 중심 계산
        // --------------------------------

        const center = new THREE.Vector3();

        box.getCenter(center);


        // 모델을 가운데로 이동
        room.position.x -= center.x;
        room.position.z -= center.z;


        // --------------------------------
        // 모델 높이 맞추기
        // --------------------------------

        const newBox = new THREE.Box3()
            .setFromObject(room);

        const minY = newBox.min.y;

        room.position.y -= minY;


        // --------------------------------
        // 모델 크기 자동 조절
        // --------------------------------

        const maxSize = Math.max(
            size.x,
            size.y,
            size.z
        );


        if (maxSize > 30) {

            const scale =
                20 / maxSize;

            room.scale.set(
                scale,
                scale,
                scale
            );

        }


        // --------------------------------
        // 장면에 추가
        // --------------------------------

        scene.add(
            room
        );


        console.log(
            "방 모델 장면에 추가 완료!"
        );

    },


    // ====================================
    // 로딩 진행률
    // ====================================

    (progress) => {

        if (progress.total > 0) {

            const percent =
                progress.loaded /
                progress.total *
                100;

            console.log(
                "방 로딩:",
                Math.round(percent) + "%"
            );

        }

    },


    // ====================================
    // 실패
    // ====================================

    (error) => {

        console.error(
            "================================"
        );

        console.error(
            "방 모델을 불러오지 못했습니다."
        );

        console.error(
            error
        );

        console.error(
            "models/room.glb 파일이 있는지 확인하세요."
        );

        console.error(
            "================================"
        );

    }

);


// ========================================
// 1인칭 조작
// ========================================

const controls = new PointerLockControls(
    camera,
    document.body
);


// ========================================
// 화면 클릭 → 마우스 잠금
// ========================================

document.addEventListener(
    "click",
    () => {

        controls.lock();

    }
);


// ========================================
// 마우스 잠금
// ========================================

controls.addEventListener(
    "lock",
    () => {

        console.log(
            "게임 시작!"
        );

        if (startMessage) {

            startMessage.style.display =
                "none";

        }

    }
);


// ========================================
// 마우스 잠금 해제
// ========================================

controls.addEventListener(
    "unlock",
    () => {

        console.log(
            "게임 일시정지"
        );

        if (startMessage) {

            startMessage.style.display =
                "block";

        }

    }
);


// ========================================
// 키 입력
// ========================================

const keys = {};


// 키 누름
document.addEventListener(
    "keydown",
    (event) => {

        keys[
            event.key.toLowerCase()
        ] = true;

    }
);


// 키 뗌
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

const clock = new THREE.Clock();


function movePlayer(delta) {

    let forward = 0;
    let right = 0;


    // W
    if (keys["w"]) {

        forward += 1;

    }


    // S
    if (keys["s"]) {

        forward -= 1;

    }


    // A
    if (keys["a"]) {

        right -= 1;

    }


    // D
    if (keys["d"]) {

        right += 1;

    }


    // --------------------------------
    // 대각선 속도 보정
    // --------------------------------

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


    // --------------------------------
    // 앞뒤
    // --------------------------------

    if (forward !== 0) {

        controls.moveForward(
            forward * moveSpeed
        );

    }


    // --------------------------------
    // 좌우
    // --------------------------------

    if (right !== 0) {

        controls.moveRight(
            right * moveSpeed
        );

    }

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


    // 마우스가 잠겨 있을 때만 이동
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
