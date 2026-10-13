
(() => {
  "use strict";

  const startScreen = document.getElementById("startScreen");
  const startButton = document.getElementById("startButton");
  const dialog = document.getElementById("dialog");
  const dialogTitle = document.getElementById("dialogTitle");
  const dialogText = document.getElementById("dialogText");
  const dialogActions = document.getElementById("dialogActions");
  const dialogEyebrow = document.getElementById("dialogEyebrow");
  const closeDialogButton = document.getElementById("closeDialog");
  const prompt = document.getElementById("interactPrompt");
  const message = document.getElementById("message");
  const objective = document.getElementById("objective");
  const winScreen = document.getElementById("winScreen");
  const restartButton = document.getElementById("restartButton");

  if (!window.THREE) {
    alert("3D 라이브러리를 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요.");
    return;
  }

  const THREE = window.THREE;
  let scene, camera, renderer, clock;
  let started = false;
  let gameWon = false;
  let pointerLocked = false;
  let yaw = 0;
  let pitch = 0;
  let verticalVelocity = 0;
  let grounded = true;
  let messageTimer = null;
  let nearbyObject = null;
  let dialogOpen = false;

  const keys = new Set();
  const colliders = [];
  const interactables = [];
  const roomObjects = {};
  const player = {
    x: 0,
    z: 4.2,
    radius: 0.34,
    eyeHeight: 1.65,
    speed: 4.8,
    jumpSpeed: 6.4,
    gravity: 17
  };

  const progress = {
    noteRead: false,
    lockerOpen: false,
    powerOn: false,
    computerRead: false,
    exitOpen: false
  };

  const materials = {
    floor: new THREE.MeshStandardMaterial({ color: 0x394653, roughness: 0.9 }),
    wall: new THREE.MeshStandardMaterial({ color: 0x647583, roughness: 0.88 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x17232d, roughness: 0.7 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x8c9ba5, metalness: 0.65, roughness: 0.35 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x705b49, roughness: 0.8 }),
    cyan: new THREE.MeshStandardMaterial({ color: 0x43e4d0, emissive: 0x125b58, emissiveIntensity: 1.4 }),
    red: new THREE.MeshStandardMaterial({ color: 0xff645e, emissive: 0x651713, emissiveIntensity: 0.8 }),
    screen: new THREE.MeshStandardMaterial({ color: 0x0d2b36, emissive: 0x0b6573, emissiveIntensity: 1.1 }),
    paper: new THREE.MeshStandardMaterial({ color: 0xf0e6c8, roughness: 1 })
  };

  function makeBox(name, size, position, material, options = {}) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size[0], size[1], size[2]),
      material
    );
    mesh.name = name;
    mesh.position.set(position[0], position[1], position[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    if (options.collider) {
      colliders.push({
        minX: position[0] - size[0] / 2,
        maxX: position[0] + size[0] / 2,
        minZ: position[2] - size[2] / 2,
        maxZ: position[2] + size[2] / 2
      });
    }
    return mesh;
  }

  function addInteractable(id, label, position, action, range = 2.35) {
    interactables.push({
      id,
      label,
      position: new THREE.Vector3(position[0], position[1], position[2]),
      action,
      range
    });
  }

  function addLamp(position) {
    const lamp = new THREE.PointLight(0x8bd9ff, 35, 8, 2);
    lamp.position.set(position[0], position[1], position[2]);
    scene.add(lamp);
    makeBox("lamp", [0.7, 0.08, 0.35], [position[0], position[1] + 0.12, position[2]], materials.cyan);
  }

  function createRoom() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111d29);
    scene.fog = new THREE.Fog(0x111d29, 17, 34);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.rotation.order = "YXZ";

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.getElementById("game").appendChild(renderer.domElement);

    clock = new THREE.Clock();

    scene.add(new THREE.HemisphereLight(0xc5e6ff, 0x25303a, 2.1));
    const mainLight = new THREE.DirectionalLight(0xffe7c2, 2.3);
    mainLight.position.set(-4, 9, 5);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.set(1024, 1024);
    scene.add(mainLight);

    // Floor: the player's feet stay on y=0; camera is 1.65 units above it.
    makeBox("floor", [18, 0.3, 14], [0, -0.15, 0], materials.floor);
    // Outer walls. Front wall has an opening for the exit door.
    makeBox("backWall", [18, 4, 0.3], [0, 2, 7], materials.wall);
    makeBox("leftWall", [0.3, 4, 14], [-9, 2, 0], materials.wall);
    makeBox("rightWall", [0.3, 4, 14], [9, 2, 0], materials.wall);
    makeBox("frontWallLeft", [6.3, 4, 0.3], [-5.85, 2, -7], materials.wall);
    makeBox("frontWallRight", [6.3, 4, 0.3], [5.85, 2, -7], materials.wall);
    makeBox("frontWallTop", [5.4, 1.2, 0.3], [0, 3.4, -7], materials.wall);

    // Simple ceiling beams and wall lights make the room feel 3D without an external model.
    for (let x = -6; x <= 6; x += 4) {
      makeBox("ceilingBeam", [0.12, 0.12, 13.5], [x, 3.92, 0], materials.dark);
    }
    addLamp([-5, 3.45, 1.8]);
    addLamp([0, 3.45, 1.8]);
    addLamp([5, 3.45, 1.8]);

    // Door and keypad at the far end.
    roomObjects.exitDoor = makeBox("exitDoor", [3.1, 3.25, 0.22], [0, 1.62, -6.78], materials.dark);
    makeBox("doorFrameTop", [3.6, 0.18, 0.4], [0, 3.35, -6.76], materials.metal);
    makeBox("doorFrameLeft", [0.18, 3.4, 0.4], [-1.7, 1.7, -6.76], materials.metal);
    makeBox("doorFrameRight", [0.18, 3.4, 0.4], [1.7, 1.7, -6.76], materials.metal);
    roomObjects.exitLight = makeBox("exitLight", [0.25, 0.18, 0.08], [1.15, 2.65, -6.62], materials.red);
    makeBox("exitKeypad", [0.42, 0.62, 0.14], [2.05, 1.35, -6.5], materials.dark);
    makeBox("exitKeypadScreen", [0.28, 0.16, 0.04], [2.05, 1.51, -6.405], materials.cyan);

    // Desk and paper note. The desk is an obstacle; approach it from the front.
    makeBox("deskTop", [2.7, 0.16, 1.2], [-5, 0.95, -0.2], materials.wood, { collider: true });
    makeBox("deskLeg1", [0.14, 0.95, 0.14], [-6.15, 0.47, -0.65], materials.dark);
    makeBox("deskLeg2", [0.14, 0.95, 0.14], [-3.85, 0.47, -0.65], materials.dark);
    makeBox("deskLeg3", [0.14, 0.95, 0.14], [-6.15, 0.47, 0.25], materials.dark);
    makeBox("deskLeg4", [0.14, 0.95, 0.14], [-3.85, 0.47, 0.25], materials.dark);
    roomObjects.note = makeBox("note", [0.55, 0.025, 0.38], [-5, 1.05, -0.2], materials.paper);
    addInteractable("note", "책상 위 메모", [-5, 1.25, -0.2], showNote, 2.5);

    // Locker, placed with clear approach space.
    makeBox("lockerBody", [1.25, 1.85, 0.75], [-1.3, 0.93, -0.4], materials.metal, { collider: true });
    roomObjects.lockerLight = makeBox("lockerLight", [0.12, 0.12, 0.06], [-1.3, 1.35, -0.785], materials.red);
    makeBox("lockerKeypad", [0.3, 0.38, 0.08], [-0.87, 1.05, -0.805], materials.dark);
    addInteractable("locker", "잠긴 보관함", [-1.3, 1.0, -1.0], showLocker, 2.5);

    // Power switch on a freestanding wall panel.
    makeBox("switchPanel", [1.25, 1.65, 0.22], [3.2, 1.2, -0.55], materials.dark, { collider: true });
    roomObjects.switchLight = makeBox("switchLight", [0.18, 0.18, 0.08], [3.2, 1.7, -0.41], materials.red);
    roomObjects.switchLever = makeBox("switchLever", [0.18, 0.36, 0.12], [3.2, 1.2, -0.38], materials.metal);
    addInteractable("switch", "전원 스위치", [3.2, 1.2, -0.1], showSwitch, 2.5);

    // Computer on a small table at the back-right area.
    makeBox("computerDesk", [1.65, 0.14, 0.85], [4.9, 0.95, 3.1], materials.wood, { collider: true });
    makeBox("computerLeg1", [0.12, 0.95, 0.12], [4.25, 0.47, 2.8], materials.dark);
    makeBox("computerLeg2", [0.12, 0.95, 0.12], [5.55, 0.47, 2.8], materials.dark);
    roomObjects.monitor = makeBox("monitor", [0.95, 0.62, 0.12], [4.9, 1.35, 3.0], materials.dark);
    roomObjects.monitorScreen = makeBox("monitorScreen", [0.78, 0.43, 0.035], [4.9, 1.37, 2.925], materials.screen);
    addInteractable("computer", "컴퓨터", [4.9, 1.4, 2.45], showComputer, 2.6);

    // A few harmless environmental props for scale.
    makeBox("crate1", [1.0, 0.75, 0.9], [6.9, 0.38, -2.5], materials.wood, { collider: true });
    makeBox("crate2", [0.8, 0.6, 0.75], [7.0, 0.3, -3.35], materials.dark);
    makeBox("wallStripe", [0.06, 2.4, 0.02], [-8.78, 2, -2.0], materials.cyan);

    addInteractable("exit", "잠긴 출구", [0, 1.4, -6.05], showExit, 2.7);

    // Room boundary collision boxes: keeps the player inside the room.
    colliders.push(
      { minX: -9, maxX: 9, minZ: 6.65, maxZ: 7.5 },
      { minX: -9.5, maxX: -8.65, minZ: -7.2, maxZ: 7.2 },
      { minX: 8.65, maxX: 9.5, minZ: -7.2, maxZ: 7.2 },
      { minX: -9, maxX: -1.85, minZ: -7.4, maxZ: -6.65 },
      { minX: 1.85, maxX: 9, minZ: -7.4, maxZ: -6.65 }
    );

    camera.position.set(player.x, player.eyeHeight, player.z);
    updateObjective();
  }

  function showMessage(text, duration = 2400) {
    message.textContent = text;
    message.classList.add("visible");
    clearTimeout(messageTimer);
    messageTimer = setTimeout(() => message.classList.remove("visible"), duration);
  }

  function openDialog(title, text, actions = [], eyebrow = "INTERACTION") {
    dialogTitle.textContent = title;
    dialogText.textContent = text;
    dialogEyebrow.textContent = eyebrow;
    dialogActions.replaceChildren();
    actions.forEach((action) => dialogActions.appendChild(action));
    dialog.classList.remove("hidden");
    dialogOpen = true;
    if (document.pointerLockElement) document.exitPointerLock();
  }

  function closeDialog() {
    dialog.classList.add("hidden");
    dialogOpen = false;
  }

  function makeButton(label, onClick, secondary = false) {
    const button = document.createElement("button");
    button.textContent = label;
    if (secondary) button.className = "secondary-button";
    button.addEventListener("click", onClick);
    return button;
  }

  function makeCodeForm(placeholder, onSubmit) {
    const input = document.createElement("input");
    input.type = "text";
    input.inputMode = "numeric";
    input.maxLength = 4;
    input.placeholder = placeholder;
    input.setAttribute("aria-label", "숫자 코드");
    const submit = makeButton("확인", () => onSubmit(input.value.trim()));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") onSubmit(input.value.trim());
    });
    setTimeout(() => input.focus(), 0);
    return [input, submit];
  }

  function showNote() {
    progress.noteRead = true;
    openDialog("책상 위 메모", "연구실 번호: 2580\n\n메모 아래에는 작은 글씨가 적혀 있다.\n'보관함의 번호로 사용하라.'", [
      makeButton("확인", closeDialog)
    ], "CLUE 01");
    updateObjective();
  }

  function showLocker() {
    if (progress.lockerOpen) {
      openDialog("보관함", "보관함은 이미 열려 있다.\n안내문: 전원 스위치를 켜야 컴퓨터가 작동한다.", [
        makeButton("확인", closeDialog)
      ]);
      return;
    }
    openDialog("잠긴 보관함", "4자리 비밀번호를 입력하세요.", makeCodeForm("비밀번호 4자리", (code) => {
      if (code === "2580") {
        progress.lockerOpen = true;
        roomObjects.lockerLight.material = materials.cyan;
        closeDialog();
        updateObjective();
        showMessage("보관함이 열렸다! 안에서 전원 안내문을 찾았다.");
        openDialog("보관함 안의 안내문", "전원 스위치를 켜야 컴퓨터가 작동한다.\n\n이제 벽의 전원 장치를 조사하자.", [
          makeButton("확인", closeDialog)
        ], "CLUE 02");
      } else {
        showMessage("번호가 맞지 않는다. 메모를 다시 확인해 보자.");
      }
    }), "LOCKER");
  }

  function showSwitch() {
    if (!progress.lockerOpen) {
      openDialog("전원 스위치", "스위치 옆에 작은 표시가 있다.\n'보관함의 안내문을 먼저 확인하라.'", [
        makeButton("확인", closeDialog)
      ]);
      return;
    }
    if (progress.powerOn) {
      openDialog("전원 스위치", "전원이 이미 켜져 있다. 컴퓨터를 조사해 보자.", [
        makeButton("확인", closeDialog)
      ]);
      return;
    }
    openDialog("전원 스위치", "전원 스위치를 올릴까요?", [
      makeButton("전원 켜기", () => {
        progress.powerOn = true;
        roomObjects.switchLight.material = materials.cyan;
        roomObjects.switchLever.rotation.x = -0.45;
        roomObjects.monitorScreen.material = materials.cyan;
        closeDialog();
        updateObjective();
        showMessage("전원이 복구되었다. 컴퓨터 화면이 켜졌다!");
      }),
      makeButton("취소", closeDialog, true)
    ]);
  }

  function showComputer() {
    if (!progress.powerOn) {
      openDialog("컴퓨터", "화면이 꺼져 있다.\n먼저 전원 스위치를 켜야 한다.", [
        makeButton("확인", closeDialog)
      ]);
      return;
    }
    progress.computerRead = true;
    roomObjects.monitorScreen.material = new THREE.MeshStandardMaterial({
      color: 0x70f2d5,
      emissive: 0x2ac9a8,
      emissiveIntensity: 1.7
    });
    openDialog("연구실 컴퓨터", "전원 복구 완료.\n\n최종 출구 코드: 7314\n\n출구의 암호 입력 장치에 이 번호를 입력하라.", [
      makeButton("코드 기억하기", closeDialog)
    ], "SYSTEM MESSAGE");
    updateObjective();
  }

  function showExit() {
    if (progress.exitOpen) {
      winScreen.classList.remove("hidden");
      return;
    }
    if (!progress.computerRead) {
      openDialog("잠긴 출구", "출구는 잠겨 있다.\n컴퓨터에서 최종 출구 코드를 확인해야 한다.", [
        makeButton("확인", closeDialog)
      ]);
      return;
    }
    openDialog("출구 암호 장치", "최종 탈출 코드 4자리를 입력하세요.", makeCodeForm("탈출 코드", (code) => {
      if (code === "7314") {
        progress.exitOpen = true;
        roomObjects.exitLight.material = materials.cyan;
        roomObjects.exitDoor.position.x = 3.6;
        roomObjects.exitDoor.rotation.y = -0.08;
        closeDialog();
        gameWon = true;
        objective.textContent = "목표 완료: 탈출 성공!";
        showMessage("출구 잠금이 해제되었다!", 3200);
        setTimeout(() => {
          if (gameWon) winScreen.classList.remove("hidden");
        }, 700);
      } else {
        showMessage("코드가 틀렸다. 컴퓨터 화면을 다시 확인하자.");
      }
    }), "FINAL LOCK");
  }

  function updateObjective() {
    if (progress.exitOpen) objective.textContent = "목표 완료: 탈출 성공!";
    else if (progress.computerRead) objective.textContent = "목표: 출구에 7314 입력";
    else if (progress.powerOn) objective.textContent = "목표: 컴퓨터에서 탈출 코드 확인";
    else if (progress.lockerOpen) objective.textContent = "목표: 전원 스위치 켜기";
    else objective.textContent = "목표: 메모를 찾아 보관함 열기";
  }

  function distanceXZ(a, b) {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  function getNearbyInteractable() {
    const playerPos = new THREE.Vector3(player.x, 1.2, player.z);
    let best = null;
    let bestDistance = Infinity;
    for (const item of interactables) {
      const d = distanceXZ(playerPos, item.position);
      if (d < item.range && d < bestDistance) {
        // Only show a prompt when the object is roughly in front of the player.
        const toObject = new THREE.Vector3(item.position.x - player.x, 0, item.position.z - player.z).normalize();
        const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
        if (toObject.dot(forward) > -0.05) {
          best = item;
          bestDistance = d;
        }
      }
    }
    return best;
  }

  function collides(x, z) {
    const r = player.radius;
    // Keep the feet within the floor's walkable area.
    if (x < -8.45 + r || x > 8.45 - r || z < -6.55 + r || z > 6.55 - r) {
      // Door opening is walkable only after it has been unlocked.
      if (!(progress.exitOpen && Math.abs(x) < 1.55 && z < -6.0 && z > -7.0)) return true;
    }

    for (const c of colliders) {
      const closestX = Math.max(c.minX, Math.min(x, c.maxX));
      const closestZ = Math.max(c.minZ, Math.min(z, c.maxZ));
      const dx = x - closestX;
      const dz = z - closestZ;
      if (dx * dx + dz * dz < r * r) return true;
    }
    // Keep the closed door solid.
    if (!progress.exitOpen && Math.abs(x) < 1.55 && z < -6.45) return true;
    return false;
  }

  function updateMovement(delta) {
    if (!started || dialogOpen || gameWon) return;

    const forwardInput = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0);
    const sideInput = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);

    let moveX = -Math.sin(yaw) * forwardInput + Math.cos(yaw) * sideInput;
    let moveZ = -Math.cos(yaw) * forwardInput - Math.sin(yaw) * sideInput;
    const length = Math.hypot(moveX, moveZ);
    if (length > 0) {
      moveX /= length;
      moveZ /= length;
    }

    const sprint = keys.has("ShiftLeft") || keys.has("ShiftRight");
    const speed = player.speed * (sprint ? 1.35 : 1);
    const nextX = player.x + moveX * speed * delta;
    const nextZ = player.z + moveZ * speed * delta;

    // Resolve X and Z separately so the player can slide along walls naturally.
    if (!collides(nextX, player.z)) player.x = nextX;
    if (!collides(player.x, nextZ)) player.z = nextZ;

    if ((keys.has("Space")) && grounded) {
      verticalVelocity = player.jumpSpeed;
      grounded = false;
    }
    verticalVelocity -= player.gravity * delta;
    let nextY = camera.position.y + verticalVelocity * delta;
    if (nextY <= player.eyeHeight) {
      nextY = player.eyeHeight;
      verticalVelocity = 0;
      grounded = true;
    }
    camera.position.set(player.x, nextY, player.z);
    camera.rotation.set(pitch, yaw, 0, "YXZ");
  }

  function updatePrompt() {
    if (!started || dialogOpen || gameWon) {
      prompt.classList.add("hidden");
      nearbyObject = null;
      return;
    }
    nearbyObject = getNearbyInteractable();
    if (nearbyObject) {
      prompt.textContent = `[E] ${nearbyObject.label}`;
      prompt.classList.remove("hidden");
    } else {
      prompt.classList.add("hidden");
    }
  }

  function interact() {
    if (!started || dialogOpen || gameWon) return;
    if (!nearbyObject) {
      showMessage("조사할 물건 가까이에서 E를 눌러 보자.");
      return;
    }
    nearbyObject.action();
  }

  function resetGame() {
    progress.noteRead = false;
    progress.lockerOpen = false;
    progress.powerOn = false;
    progress.computerRead = false;
    progress.exitOpen = false;
    player.x = 0;
    player.z = 4.2;
    verticalVelocity = 0;
    grounded = true;
    yaw = 0;
    pitch = 0;
    gameWon = false;
    started = false;
    keys.clear();
    location.reload();
  }

  startButton.addEventListener("click", () => {
    started = true;
    startScreen.classList.add("hidden");
    renderer.domElement.requestPointerLock?.();
    showMessage("연구실에 들어왔다. 책상 위 메모부터 조사하자.", 3500);
  });

  closeDialogButton.addEventListener("click", closeDialog);
  restartButton.addEventListener("click", resetGame);

  rendererSetup();

  function rendererSetup() {
    createRoom();

    document.addEventListener("pointerlockchange", () => {
      pointerLocked = document.pointerLockElement === renderer.domElement;
    });

    renderer.domElement.addEventListener("click", () => {
      if (started && !dialogOpen && !gameWon && !pointerLocked) {
        renderer.domElement.requestPointerLock?.();
      }
    });

    document.addEventListener("mousemove", (event) => {
      if (!pointerLocked || dialogOpen || !started) return;
      yaw -= event.movementX * 0.0022;
      pitch -= event.movementY * 0.0022;
      pitch = Math.max(-Math.PI / 2 + 0.08, Math.min(Math.PI / 2 - 0.08, pitch));
    });

    document.addEventListener("keydown", (event) => {
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
        event.preventDefault();
      }
      if (event.code === "Escape" && dialogOpen) {
        closeDialog();
        return;
      }
      if (event.code === "KeyE" && !event.repeat) {
        interact();
        return;
      }
      if (event.code === "Space" && !event.repeat && started && !dialogOpen && grounded) {
        keys.add("Space");
        return;
      }
      keys.add(event.code);
    });

    document.addEventListener("keyup", (event) => {
      keys.delete(event.code);
    });

    window.addEventListener("blur", () => keys.clear());
    window.addEventListener("resize", () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    function animate() {
      requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.04);
      updateMovement(delta);
      updatePrompt();
      renderer.render(scene, camera);
    }
    animate();
  }
})();
