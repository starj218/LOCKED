import * as THREE from "three";

import {
    PointerLockControls
} from "three/addons/controls/PointerLockControls.js";

import {
    GLTFLoader
} from "three/addons/loaders/GLTFLoader.js";

import {
    Octree
} from "three/addons/math/Octree.js";

import {
    Capsule
} from "three/addons/math/Capsule.js";


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

const ambientLight = new THREE.AmbientLight(
    0xffffff,
    2
);

scene.add(
    ambientLight
);


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
// 충돌용 Octree
// ========================================

const worldOctree = new Octree();


// ========================================
// 플레이어 설정
// ========================================

const playerCollider = new Capsule(
    new THREE.Vector3(
        0,
        0.35,
        0
    ),

    new THREE.Vector3(
        0,
        1.7,
        0
    ),

    0.35
);
// 플레이어 속도
const playerVelocity = new THREE.Vector3();


// 바닥에 있는지
let playerOnFloor = false;


// 중력
const gravity = 30;


// 이동 속도
const playerSpeed = 5;


// 점프 힘
const jumpSpeed = 10;


// ========================================
// 1인칭 조작
// ========================================

const controls = new PointerLockControls(
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


// 게임 시작
controls.addEventListener(
    "lock",
    () => {

        if (startMessage) {

            startMessage.style.display =
                "none";

        }

        console.log(
            "게임 시작!"
        );

    }
);


// 게임 일시정지
controls.addEventListener(
    "unlock",
    () => {

        if (startMessage) {

            startMessage.style.display =
                "block";

        }

        console.log(
            "게임 일시정지"
        );

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


        // Space = 점프
        if (
            event.code === "Space" &&
            playerOnFloor
        ) {

            playerVelocity.y =
                jumpSpeed;

            playerOnFloor = false;

        }

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
// 3D 방 모델
// ========================================

const loader = new GLTFLoader();


loader.load(

    "room.glb",


    // ====================================
    // 모델 로딩 성공
    // ====================================

    (gltf) => {

        const room = gltf.scene;


        console.log(
            "방 모델 불러오기 성공!"
        );


        // --------------------------------
        // 모델 크기 확인
        // --------------------------------

        const originalBox =
            new THREE.Box3()
                .setFromObject(room);


        const originalSize =
            new THREE.Vector3();

        originalBox.getSize(
            originalSize
        );


        console.log(
            "원래 방 크기:",
            originalSize.x,
            originalSize.y,
            originalSize.z
        );


        // --------------------------------
        // 너무 큰 모델만 자동 축소
        // --------------------------------

        const maxSize =
            Math.max(
                originalSize.x,
                originalSize.y,
                originalSize.z
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
        // 월드 좌표 갱신
        // --------------------------------

        room.updateMatrixWorld(
            true
        );


        // --------------------------------
        // 방의 중심 계산
        // --------------------------------

        const box =
            new THREE.Box3()
                .setFromObject(room);


        const center =
            new THREE.Vector3();

        box.getCenter(
            center
        );


        // --------------------------------
        // 방을 중앙에 배치
        // --------------------------------

        room.position.x -=
            center.x;

        room.position.z -=
            center.z;


        // 월드 좌표 다시 갱신
        room.updateMatrixWorld(
            true
        );


        // --------------------------------
        // 방 바닥을 y=0에 맞춤
        // --------------------------------

        const floorBox =
            new THREE.Box3()
                .setFromObject(room);


        room.position.y -=
            floorBox.min.y;


        room.updateMatrixWorld(
            true
        );


        // --------------------------------
        // 장면에 방 추가
        // --------------------------------

        scene.add(
            room
        );


        // --------------------------------
        // 충돌 데이터 생성
        // --------------------------------

        try {

            worldOctree.fromGraphNode(
                room
            );

            console.log(
                "충돌 데이터 생성 완료!"
            );

        }

        catch (error) {

            console.error(
                "충돌 데이터 생성 실패:",
                error
            );

        }


        // --------------------------------
        // 모델 정보 출력
        // --------------------------------

        const finalBox =
            new THREE.Box3()
                .setFromObject(room);


        const finalSize =
            new THREE.Vector3();

        finalBox.getSize(
            finalSize
        );


        console.log(
            "최종 방 크기:",
            finalSize.x,
            finalSize.y,
            finalSize.z
        );


        console.log(
            "방 모델 준비 완료!"
        );

    },


    // ====================================
    // 로딩 진행률
    // ====================================

    (progress) => {

        if (
            progress.total > 0
        ) {

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
    // 로딩 실패
    // ====================================

    (error) => {

        console.error(
            "방 모델을 불러오지 못했습니다."
        );

        console.error(
            error
        );

    }

);


// ========================================
// 이동 방향 계산
// ========================================

const direction =
    new THREE.Vector3();


function getMovementDirection() {

    direction.set(
        0,
        0,
        0
    );


    // W
    if (keys["w"]) {

        direction.z -= 1;

    }


    // S
    if (keys["s"]) {

        direction.z += 1;

    }


    // A
    if (keys["a"]) {

        direction.x -= 1;

    }


    // D
    if (keys["d"]) {

        direction.x += 1;

    }


    // 대각선 속도 보정
    if (
        direction.lengthSq() > 0
    ) {

        direction.normalize();

    }

}


// ========================================
// 플레이어 이동
// ========================================

function updatePlayer(delta) {

    if (
        !controls.isLocked
    ) {

        return;

    }


    // 이동 방향
    getMovementDirection();


    // --------------------------------
    // 카메라 방향 기준으로 이동
    // --------------------------------

    const forward =
        new THREE.Vector3();

    camera.getWorldDirection(
        forward
    );


    // 위아래 방향 제거
    forward.y = 0;

    forward.normalize();


    const right =
        new THREE.Vector3();

    right.crossVectors(
        forward,
        new THREE.Vector3(
            0,
            1,
            0
        )
    );


    // --------------------------------
    // 이동 벡터
    // --------------------------------

    const move =
        new THREE.Vector3();


    move.addScaledVector(
        forward,
        -direction.z
    );


    move.addScaledVector(
        right,
        direction.x
    );


    if (
        move.lengthSq() > 0
    ) {

        move.normalize();

        playerVelocity.x =
            move.x * playerSpeed;

        playerVelocity.z =
            move.z * playerSpeed;

    }

    else {

        // 멈출 때 부드럽게 정지
        playerVelocity.x *= 0.8;

        playerVelocity.z *= 0.8;

    }


    // --------------------------------
    // 중력
    // --------------------------------

    playerVelocity.y -=
        gravity * delta;


    // --------------------------------
    // 플레이어 이동
    // --------------------------------

    playerCollider.translate(
        playerVelocity.clone()
            .multiplyScalar(delta)
    );


    // --------------------------------
    // 방과 충돌 검사
    // --------------------------------

    const result =
        worldOctree.capsuleIntersect(
            playerCollider
        );


    playerOnFloor = false;


    if (result) {

        playerOnFloor =
            result.normal.y > 0;


        // 충돌한 만큼 밀어내기
        if (
            result.depth >= 0
        ) {

            playerCollider.translate(
                result.normal
                    .multiplyScalar(
                        result.depth
                    )
            );

        }


        // 바닥에 닿았으면 아래쪽 속도 제거
        if (
            playerOnFloor &&
            playerVelocity.y < 0
        ) {

            playerVelocity.y = 0;

        }


        // 벽에 부딪혔을 때
        if (
            !playerOnFloor
        ) {

            playerVelocity.addScaledVector(
                result.normal,
                -result.normal.dot(
                    playerVelocity
                )
            );

        }

    }


    // --------------------------------
    // 플레이어가 너무 아래로 떨어졌을 때
    // --------------------------------

    if (
        playerCollider.end.y < -10
    ) {

        console.log(
            "플레이어가 방 밖으로 떨어졌습니다."
        );


        // 시작 위치로 복귀
playerCollider.start.set(
    0,
    0.35,
    0
);

playerCollider.end.set(
    0,
    1.7,
    0
);

        playerVelocity.set(
            0,
            0,
            0
        );

    }


    // --------------------------------
    // 카메라 위치
    // --------------------------------

    camera.position.copy(
        playerCollider.end
    );

}


// ========================================
// 게임 루프
// ========================================

const clock =
    new THREE.Clock();


function gameLoop() {

    const delta =
        Math.min(
            clock.getDelta(),
            0.05
        );


    updatePlayer(
        delta
    );


    renderer.render(
        scene,
        camera
    );


    requestAnimationFrame(
        gameLoop
    );

}


gameLoop();


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
