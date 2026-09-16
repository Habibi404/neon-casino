// ==========================================
// NEON CASINO - MULTIPLAYER P2P
// Wszystkie itemy są wyłącznie wirtualne.
// ==========================================

let nickname = "";
let peer = null;
let connection = null;

let isHost = false;
let roomCode = "";

let balance = 10000;
let inventory = [];

let players = {};
let pot = [];


// ==========================================
// ELEMENTY STRONY
// ==========================================

const startScreen = document.getElementById("start-screen");
const lobbyScreen = document.getElementById("lobby-screen");
const gameScreen = document.getElementById("game-screen");

const nicknameInput = document.getElementById("nickname");
const continueBtn = document.getElementById("continue-btn");

const lobbyNickname = document.getElementById("lobby-nickname");
const lobbyStatus = document.getElementById("lobby-status");

const createRoomBtn = document.getElementById("create-room-btn");
const joinRoomBtn = document.getElementById("join-room-btn");
const roomCodeInput = document.getElementById("room-code-input");

const roomCodeDisplay = document.getElementById("room-code-display");
const copyRoomBtn = document.getElementById("copy-room-btn");

const playersList = document.getElementById("players-list");
const inventoryBox = document.getElementById("inventory");
const potBox = document.getElementById("pot");

const balanceDisplay = document.getElementById("balance");

const gameStatus = document.getElementById("game-status");


// ==========================================
// POMOCNICZE
// ==========================================

function showScreen(screen) {

    startScreen.classList.add("hidden");
    lobbyScreen.classList.add("hidden");
    gameScreen.classList.add("hidden");

    screen.classList.remove("hidden");
}


function randomCode() {

    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let result = "";

    for (let i = 0; i < 6; i++) {
        result += chars.charAt(
            Math.floor(Math.random() * chars.length)
        );
    }

    return result;
}


function safeText(text) {

    return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function setStatus(text) {
    gameStatus.textContent = text;
}


// ==========================================
// START
// ==========================================

continueBtn.addEventListener("click", () => {

    const value = nicknameInput.value.trim();

    if (!value) {
        alert("Wpisz nick.");
        return;
    }

    nickname = value.substring(0, 20);

    lobbyNickname.textContent = nickname;

    showScreen(lobbyScreen);
});


nicknameInput.addEventListener("keydown", (event) => {

    if (event.key === "Enter") {
        continueBtn.click();
    }
});


// ==========================================
// TWORZENIE POKOJU
// ==========================================

createRoomBtn.addEventListener("click", () => {

    lobbyStatus.textContent = "Tworzenie pokoju...";

    isHost = true;

    roomCode = randomCode();

    const peerID =
        "neon-casino-" +
        roomCode.toLowerCase();

    peer = new Peer(peerID);


    peer.on("open", () => {

        players = {};

        players[nickname] = {
            nickname: nickname
        };

        openGame();

        setStatus(
            "Pokój gotowy. Wyślij kod znajomemu."
        );
    });


    peer.on("connection", (conn) => {

        // Na początek obsługujemy 2 graczy.
        if (connection && connection.open) {

            conn.on("open", () => {
                conn.send({
                    type: "room-full"
                });

                setTimeout(() => {
                    conn.close();
                }, 500);
            });

            return;
        }

        connection = conn;

        setupConnection();
    });


    peer.on("error", (error) => {

        console.error(error);

        lobbyStatus.textContent =
            "Nie udało się utworzyć pokoju. Spróbuj ponownie.";
    });
});


// ==========================================
// DOŁĄCZANIE
// ==========================================

joinRoomBtn.addEventListener("click", () => {

    const code =
        roomCodeInput.value
            .trim()
            .toUpperCase();

    if (!code) {

        lobbyStatus.textContent =
            "Wpisz kod pokoju.";

        return;
    }

    roomCode = code;

    isHost = false;

    lobbyStatus.textContent =
        "Łączenie z pokojem...";

    peer = new Peer();


    peer.on("open", () => {

        const hostPeerID =
            "neon-casino-" +
            roomCode.toLowerCase();

        connection =
            peer.connect(hostPeerID, {
                reliable: true
            });

        setupConnection();
    });


    peer.on("error", (error) => {

        console.error(error);

        lobbyStatus.textContent =
            "Błąd połączenia.";
    });
});


// ==========================================
// POŁĄCZENIE
// ==========================================

function setupConnection() {

    connection.on("open", () => {

        if (!isHost) {

            connection.send({
                type: "join",
                nickname: nickname
            });

            openGame();

            setStatus(
                "Połączono. Czekamy na synchronizację..."
            );
        }

        else {

            setStatus(
                "Znajomy połączył się z pokojem."
            );
        }
    });


    connection.on("data", (data) => {

        handleNetworkMessage(data);
    });


    connection.on("close", () => {

        setStatus(
            "Drugi gracz rozłączył się."
        );

        if (isHost) {

            const hostPlayer = players[nickname];

            players = {};

            if (hostPlayer) {
                players[nickname] = hostPlayer;
            }

            connection = null;

            broadcastState();
        }

        renderPlayers();
    });


    connection.on("error", (error) => {

        console.error(error);

        setStatus(
            "Wystąpił problem z połączeniem."
        );
    });
}


// ==========================================
// WIADOMOŚCI MULTIPLAYER
// ==========================================

function handleNetworkMessage(data) {

    if (!data || !data.type) {
        return;
    }


    // ----------------------------
    // GRACZ DOŁĄCZA
    // ----------------------------

    if (data.type === "join" && isHost) {

        let guestName =
            String(data.nickname || "Gracz")
                .substring(0, 20);

        // Jeśli obaj wpisali ten sam nick,
        // dodajemy oznaczenie.
        if (players[guestName]) {
            guestName += " (2)";
        }

        players[guestName] = {
            nickname: guestName
        };

        connection.send({
            type: "joined",
            nickname: guestName
        });

        broadcastState();

        setStatus(
            guestName + " dołączył do stołu."
        );
    }


    // ----------------------------
    // SERWER/HOST ZMIENIŁ NICK GOŚCIA
    // ----------------------------

    if (data.type === "joined" && !isHost) {

        nickname = data.nickname;

        setStatus(
            "Dołączyłeś do pokoju."
        );
    }


    // ----------------------------
    // PEŁNY STAN GRY
    // ----------------------------

    if (data.type === "state" && !isHost) {

        players = data.players || {};
        pot = data.pot || [];

        renderEverything();
    }


    // ----------------------------
    // GOŚĆ STAWIA ŻETONY
    // ----------------------------

    if (data.type === "bet-chips" && isHost) {

        const value = Number(data.value);

        if (
            !Number.isFinite(value) ||
            value <= 0
        ) {
            return;
        }

        pot.push({
            id: makeID(),
            owner: data.nickname,
            type: "chips",
            icon: "🟡",
            name: value + " żetonów",
            value: value
        });

        broadcastState();
        renderEverything();
    }


    // ----------------------------
    // GOŚĆ STAWIA ITEM
    // ----------------------------

    if (data.type === "bet-item" && isHost) {

        const item = data.item;

        if (!item) {
            return;
        }

        pot.push({
            id: makeID(),
            owner: data.nickname,
            type: "item",
            icon: item.icon || "🎁",
            name: item.name || "Item",
            value: Number(item.value) || 0
        });

        broadcastState();
        renderEverything();
    }


    // ----------------------------
    // GOŚĆ COFA SWOJE STAWKI
    // ----------------------------

    if (data.type === "undo" && isHost) {

        pot = pot.filter(
            bet => bet.owner !== data.nickname
        );

        broadcastState();
        renderEverything();
    }


    // ----------------------------
    // POKÓJ PEŁNY
    // ----------------------------

    if (data.type === "room-full") {

        alert(
            "Ten pokój jest już pełny."
        );

        location.reload();
    }
}


// ==========================================
// OTWARCIE GRY
// ==========================================

function openGame() {

    roomCodeDisplay.textContent = roomCode;

    showScreen(gameScreen);

    renderEverything();
}


// ==========================================
// SYNCHRONIZACJA HOST -> GOŚĆ
// ==========================================

function broadcastState() {

    if (
        !isHost ||
        !connection ||
        !connection.open
    ) {
        return;
    }

    connection.send({
        type: "state",
        players: players,
        pot: pot
    });
}


// ==========================================
// ŻETONY
// ==========================================

document
    .querySelectorAll(".chip")
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const value =
                    Number(
                        button.dataset.value
                    );

                placeChips(value);
            }
        );
    });


function placeChips(value) {

    if (balance < value) {

        setStatus(
            "Nie masz tylu żetonów."
        );

        return;
    }

    balance -= value;

    if (isHost) {

        pot.push({
            id: makeID(),
            owner: nickname,
            type: "chips",
            icon: "🟡",
            name: value + " żetonów",
            value: value
        });

        broadcastState();
        renderEverything();
    }

    else {

        if (
            !connection ||
            !connection.open
        ) {

            balance += value;

            setStatus(
                "Brak połączenia z hostem."
            );

            return;
        }

        connection.send({
            type: "bet-chips",
            nickname: nickname,
            value: value
        });

        renderBalance();
    }
}


// ==========================================
// ITEM SHOP
// ==========================================

document
    .querySelectorAll(".buy-item")
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const price =
                    Number(
                        button.dataset.price
                    );

                const name =
                    button.dataset.name;

                const icon =
                    button.dataset.icon;

                if (balance < price) {

                    setStatus(
                        "Za mało żetonów."
                    );

                    return;
                }

                balance -= price;

                inventory.push({
                    id: makeID(),
                    name: name,
                    icon: icon,
                    value: price
                });

                renderEverything();

                setStatus(
                    "Kupiono: " + name
                );
            }
        );
    });


// ==========================================
// WŁASNY ITEM
// ==========================================

document
    .getElementById("create-item-btn")
    .addEventListener("click", () => {

        const name =
            prompt(
                "Podaj nazwę WIRTUALNEGO itemu:"
            );

        if (!name) {
            return;
        }

        const valueText =
            prompt(
                "Podaj jego wartość w żetonach:"
            );

        const value =
            Number(valueText);

        if (
            !Number.isFinite(value) ||
            value <= 0
        ) {

            alert(
                "Podaj prawidłową wartość."
            );

            return;
        }

        inventory.push({
            id: makeID(),
            name: name.substring(0, 30),
            icon: "🎁",
            value: Math.floor(value)
        });

        renderEverything();

        setStatus(
            "Dodano wirtualny item."
        );
    });


// ==========================================
// STAWIANIE ITEMÓW
// ==========================================

function betItem(itemID) {

    const index =
        inventory.findIndex(
            item => item.id === itemID
        );

    if (index === -1) {
        return;
    }

    const item =
        inventory[index];

    inventory.splice(index, 1);


    if (isHost) {

        pot.push({
            id: makeID(),
            owner: nickname,
            type: "item",
            icon: item.icon,
            name: item.name,
            value: item.value
        });

        broadcastState();
        renderEverything();
    }

    else {

        if (
            !connection ||
            !connection.open
        ) {

            inventory.push(item);

            setStatus(
                "Brak połączenia."
            );

            return;
        }

        connection.send({
            type: "bet-item",
            nickname: nickname,
            item: item
        });

        renderEverything();
    }
}


// ==========================================
// COFANIE STAWKI
// ==========================================

document
    .getElementById("undo-bet-btn")
    .addEventListener("click", () => {

        if (isHost) {

            restoreMyBets();

            broadcastState();
            renderEverything();
        }

        else {

            restoreGuestBetsLocally();

            if (
                connection &&
                connection.open
            ) {

                connection.send({
                    type: "undo",
                    nickname: nickname
                });
            }

            renderEverything();
        }
    });


function restoreMyBets() {

    const myBets =
        pot.filter(
            bet => bet.owner === nickname
        );

    myBets.forEach(bet => {

        if (bet.type === "chips") {

            balance += bet.value;
        }

        else {

            inventory.push({
                id: makeID(),
                name: bet.name,
                icon: bet.icon,
                value: bet.value
            });
        }
    });

    pot =
        pot.filter(
            bet => bet.owner !== nickname
        );
}


function restoreGuestBetsLocally() {

    const myBets =
        pot.filter(
            bet => bet.owner === nickname
        );

    myBets.forEach(bet => {

        if (bet.type === "chips") {

            balance += bet.value;
        }

        else {

            inventory.push({
                id: makeID(),
                name: bet.name,
                icon: bet.icon,
                value: bet.value
            });
        }
    });
}


// ==========================================
// RENDEROWANIE
// ==========================================

function renderEverything() {

    renderBalance();
    renderPlayers();
    renderInventory();
    renderPot();
}


function renderBalance() {

    balanceDisplay.textContent =
        balance.toLocaleString("pl-PL");
}


function renderPlayers() {

    let html = "";

    const names =
        Object.keys(players);

    if (
        !names.includes(nickname)
    ) {

        names.push(nickname);
    }

    names.forEach(name => {

        html += `
            <div class="player-card">

                <span class="online-dot"></span>

                ${safeText(name)}

                ${
                    name === nickname
                    ? "<small> (Ty)</small>"
                    : ""
                }

            </div>
        `;
    });

    playersList.innerHTML = html;
}


function renderInventory() {

    if (inventory.length === 0) {

        inventoryBox.innerHTML =
            `<p style="color:#84948d">
                Brak itemów.
            </p>`;

        return;
    }

    let html = "";

    inventory.forEach(item => {

        html += `
            <div class="inventory-item">

                <div>
                    ${safeText(item.icon)}
                    ${safeText(item.name)}

                    <br>

                    <small>
                        ${item.value} 🟡
                    </small>
                </div>

                <button
                    onclick="betItem('${item.id}')"
                >
                    POSTAW
                </button>

            </div>
        `;
    });

    inventoryBox.innerHTML = html;
}


function renderPot() {

    if (pot.length === 0) {

        potBox.innerHTML = `
            <span class="empty-pot">
                Tutaj pojawią się postawione przedmioty
            </span>
        `;

        return;
    }

    let html = "";

    pot.forEach(bet => {

        html += `
            <div class="bet-item">

                <div>
                    ${safeText(bet.icon)}
                    ${safeText(bet.name)}
                </div>

                <div class="bet-owner">
                    ${safeText(bet.owner)}
                </div>

            </div>
        `;
    });

    potBox.innerHTML = html;
}


// ==========================================
// KOPIOWANIE KODU
// ==========================================

copyRoomBtn.addEventListener(
    "click",
    async () => {

        try {

            await navigator.clipboard.writeText(
                roomCode
            );

            setStatus(
                "Kod pokoju skopiowany: " +
                roomCode
            );
        }

        catch {

            prompt(
                "Skopiuj kod:",
                roomCode
            );
        }
    }
);


// ==========================================
// ID ITEMÓW
// ==========================================

function makeID() {

    return (
        Date.now().toString(36) +
        Math.random()
            .toString(36)
            .substring(2, 8)
    );
}


// ==========================================
// STARTOWE RENDEROWANIE
// ==========================================

renderBalance();
