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
// 장면
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
    0
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

scene.add(ambientLight);


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

scene.add(roomLight);


// ========================================
// 충돌 시스템
// ========================================

const worldOctree = new Octree();


// ========================================
// 테스트용 바닥
// ========================================

const testFloor = new THREE.Mesh(
    new THREE.BoxGeometry(
        30,
        0.2,
        30
    ),
    new THREE.MeshStandardMaterial({
        color: 0x555555
    })
);

testFloor.position.set(
    0,
    0,
    0
);

scene.add(testFloor);

worldOctree.fromGraphNode(
    testFloor
);


// ========================================
// 플레이어
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


const playerVelocity =
    new THREE.Vector3();


let playerOnFloor = false;


const gravity = 30;

const playerSpeed = 5;

const jumpSpeed = 10;


// ========================================
// 1인칭 조작
// ========================================

const controls =
    new PointerLockControls(
        camera,
        document.body
    );


// 화면 클릭 → 게임 시작
document.addEventListener(
    "click",
    () => {

        if (!controls.isLocked) {
            controls.lock();
        }

    }
);


controls.addEventListener(
    "lock",
    () => {

        if (startMessage) {
            startMessage.style.display =
                "none";
        }

    }
);


controls.addEventListener(
    "unlock",
    () => {

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


        // SPACE = 점프
        if (
            event.code === "Space" &&
            playerOnFloor
        ) {

            playerVelocity.y =
                jumpSpeed;

            playerOnFloor =
                false;

            console.log("점프!");

        }


        // E = 상호작용
        if (
            event.key.toLowerCase() === "e"
        ) {

            interact();

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
// 방 모델
// ========================================

const loader =
    new GLTFLoader();


let room = null;


loader.load(

    "room.glb",

    (gltf) => {

        room =
            gltf.scene;


        console.log(
            "방 모델 불러오기 성공!"
        );


        // --------------------------------
        // 원래 크기
        // --------------------------------

        const originalBox =
            new THREE.Box3()
                .setFromObject(
                    room
                );


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
        // 너무 큰 모델 축소
        // --------------------------------

        const maxSize =
            Math.max(
                originalSize.x,
                originalSize.y,
                originalSize.z
            );


        if (
            maxSize > 30
        ) {

            const scale =
                20 / maxSize;


            room.scale.set(
                scale,
                scale,
                scale
            );

        }


        room.updateMatrixWorld(
            true
        );


        // --------------------------------
        // 중앙 정렬
        // --------------------------------

        const box =
            new THREE.Box3()
                .setFromObject(
                    room
                );


        const center =
            new THREE.Vector3();


        box.getCenter(
            center
        );


        room.position.x -=
            center.x;


        room.position.z -=
            center.z;


        room.updateMatrixWorld(
            true
        );


        // --------------------------------
        // 바닥 정렬
        // --------------------------------

        const floorBox =
            new THREE.Box3()
                .setFromObject(
                    room
                );


        room.position.y -=
            floorBox.min.y;


        room.updateMatrixWorld(
            true
        );


        // --------------------------------
        // 방 추가
        // --------------------------------

        scene.add(
            room
        );


        // --------------------------------
        // 방 충돌
        // --------------------------------

        try {

            worldOctree.fromGraphNode(
                room
            );

            console.log(
                "방 충돌 데이터 생성 완료!"
            );

        }

        catch (error) {

            console.error(
                "방 충돌 생성 실패:",
                error
            );

        }


        console.log(
            "방 준비 완료!"
        );

    },


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


    (error) => {

        console.error(
            "room.glb 로딩 실패!"
        );

        console.error(
            error
        );

    }

);


// ========================================
// E키 상호작용 시스템
// ========================================

// 레이캐스터
const raycaster =
    new THREE.Raycaster();


// 상호작용 가능한 최대 거리
const interactDistance = 4;


// 조사 메시지
let interactionMessage =
    document.getElementById(
        "interactionMessage"
    );


// 메시지가 없다면 자동 생성
if (!interactionMessage) {

    interactionMessage =
        document.createElement(
            "div"
        );


    interactionMessage.id =
        "interactionMessage";


    interactionMessage.style.position =
        "fixed";


    interactionMessage.style.left =
        "50%";


    interactionMessage.style.top =
        "75%";


    interactionMessage.style.transform =
        "translate(-50%, -50%)";


    interactionMessage.style.padding =
        "15px 25px";


    interactionMessage.style.background =
        "rgba(0, 0, 0, 0.8)";


    interactionMessage.style.color =
        "white";


    interactionMessage.style.fontSize =
        "18px";


    interactionMessage.style.borderRadius =
        "10px";


    interactionMessage.style.display =
        "none";


    interactionMessage.style.zIndex =
        "100";


    interactionMessage.style.textAlign =
        "center";


    document.body.appendChild(
        interactionMessage
    );

}


// ========================================
// 바라보고 있는 물체 찾기
// ========================================

function getInteractObject() {

    if (!room) {
        return null;
    }


    // 화면 중앙에서 레이 발사
    raycaster.setFromCamera(
        new THREE.Vector2(0, 0),
        camera
    );


    const objects =
        raycaster.intersectObjects(
            room.children,
            true
        );


    for (
        const hit of objects
    ) {

        if (
            hit.distance <=
            interactDistance
        ) {

            return hit;

        }

    }


    return null;

}


// ========================================
// 물체 조사
// ========================================

function interact() {

    const hit =
        getInteractObject();


    if (!hit) {

        showInteractionMessage(
            "조사할 수 있는 물체가 없습니다."
        );

        return;

    }


    // 가장 가까운 부모 이름 찾기
    let object =
        hit.object;


    let objectName =
        object.name;


    while (
        object.parent &&
        object.parent !== room
    ) {

        if (
            object.parent.name
        ) {

            objectName =
                object.parent.name;

        }


        object =
            object.parent;

    }


    // 이름이 없을 경우
    if (
        !objectName
    ) {

        objectName =
            "알 수 없는 물체";

    }


    console.log(
        "조사:",
        objectName
    );


    showInteractionMessage(
        "🔎 " + objectName
    );

}


// ========================================
// 조사 메시지 표시
// ========================================

let messageTimer = null;


function showInteractionMessage(
    text
) {

    interactionMessage.textContent =
        text;


    interactionMessage.style.display =
        "block";


    clearTimeout(
        messageTimer
    );


    messageTimer =
        setTimeout(
            () => {

                interactionMessage.style.display =
                    "none";

            },

            2500
        );

}


// ========================================
// 이동 방향
// ========================================

const direction =
    new THREE.Vector3();


function getMovementDirection() {

    direction.set(
        0,
        0,
        0
    );


    if (keys["w"]) {
        direction.z -= 1;
    }


    if (keys["s"]) {
        direction.z += 1;
    }


    if (keys["a"]) {
        direction.x -= 1;
    }


    if (keys["d"]) {
        direction.x += 1;
    }


    if (
        direction.lengthSq() > 0
    ) {

        direction.normalize();

    }

}


// ========================================
// 플레이어 업데이트
// ========================================

function updatePlayer(delta) {

    if (
        !controls.isLocked
    ) {

        return;

    }


    getMovementDirection();


    // --------------------------------
    // 앞 방향
    // --------------------------------

    const forward =
        new THREE.Vector3();


    camera.getWorldDirection(
        forward
    );


    forward.y = 0;


    if (
        forward.lengthSq() > 0
    ) {

        forward.normalize();

    }


    // --------------------------------
    // 오른쪽 방향
    // --------------------------------

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


    right.normalize();


    // --------------------------------
    // 이동
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

        playerVelocity.x *= 0.8;

        playerVelocity.z *= 0.8;

    }


    // --------------------------------
    // 중력
    // --------------------------------

    playerVelocity.y -=
        gravity * delta;


    // --------------------------------
    // 이동
    // --------------------------------

    playerCollider.translate(

        playerVelocity
            .clone()
            .multiplyScalar(
                delta
            )

    );


    // --------------------------------
    // 충돌
    // --------------------------------

    const result =
        worldOctree.capsuleIntersect(
            playerCollider
        );


    playerOnFloor =
        false;


    if (result) {

        playerOnFloor =
            result.normal.y > 0;


        playerCollider.translate(

            result.normal
                .multiplyScalar(
                    result.depth
                )

        );


        // 바닥
        if (
            playerOnFloor
        ) {

            if (
                playerVelocity.y < 0
            ) {

                playerVelocity.y =
                    0;

            }

        }


        // 벽
        else {

            playerVelocity.addScaledVector(

                result.normal,

                -result.normal.dot(
                    playerVelocity
                )

            );

        }

    }


    // --------------------------------
    // 추락 방지
    // --------------------------------

    if (
        playerCollider.end.y < -10
    ) {

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


        playerOnFloor =
            false;

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
