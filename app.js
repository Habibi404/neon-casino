// ==========================================
// NEON CASINO - MULTIPLAYER
// Wersja 2
// Przedmioty i żetony są wyłącznie wirtualne.
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
// PODSTAWOWE FUNKCJE
// ==========================================

function showScreen(screen) {
    startScreen.classList.add("hidden");
    lobbyScreen.classList.add("hidden");
    gameScreen.classList.add("hidden");

    screen.classList.remove("hidden");
}


function setStatus(text) {
    gameStatus.textContent = text;
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


function makeID() {
    return (
        Date.now().toString(36) +
        Math.random().toString(36).substring(2, 9)
    );
}


function safeText(text) {
    return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


// ==========================================
// NICK
// ==========================================

continueBtn.addEventListener("click", function () {

    const value = nicknameInput.value.trim();

    if (!value) {
        alert("Wpisz swój nick.");
        return;
    }

    nickname = value.substring(0, 20);

    lobbyNickname.textContent = nickname;

    showScreen(lobbyScreen);
});


nicknameInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
        continueBtn.click();
    }
});


// ==========================================
// TWORZENIE POKOJU
// ==========================================

createRoomBtn.addEventListener("click", function () {

    if (typeof Peer === "undefined") {
        alert("Nie udało się załadować PeerJS.");
        return;
    }

    createRoomBtn.disabled = true;

    lobbyStatus.textContent = "Tworzenie pokoju...";

    isHost = true;
    roomCode = randomCode();

    const hostID =
        "neon-casino-" + roomCode.toLowerCase();

    console.log("Tworzenie hosta:", hostID);

    peer = new Peer(hostID, {
        debug: 2
    });


    peer.on("open", function (id) {

        console.log("HOST PEER OPEN:", id);

        players = {};

        players[nickname] = {
            nickname: nickname
        };

        openGame();

        setStatus(
            "Pokój działa. Wyślij kod znajomemu: " +
            roomCode
        );
    });


    peer.on("connection", function (conn) {

        console.log(
            "Próba połączenia od:",
            conn.peer
        );

        if (connection && connection.open) {

            conn.on("open", function () {

                conn.send({
                    type: "room-full"
                });

                setTimeout(function () {
                    conn.close();
                }, 500);
            });

            return;
        }

        connection = conn;

        setupConnection();
    });


    peer.on("disconnected", function () {

        console.log("PeerJS disconnected");

        if (!peer.destroyed) {

            setStatus(
                "Utracono kontakt z serwerem pośredniczącym. Próba ponownego połączenia..."
            );

            try {
                peer.reconnect();
            } catch (error) {
                console.error(error);
            }
        }
    });


    peer.on("error", function (error) {

        console.error("PEER ERROR:", error);

        const type =
            error && error.type
                ? error.type
                : "unknown";

        if (gameScreen.classList.contains("hidden")) {
            lobbyStatus.textContent =
                "Błąd PeerJS: " + type;
        } else {
            setStatus(
                "Błąd PeerJS: " + type
            );
        }

        alert(
            "Błąd połączenia PeerJS: " + type
        );

        createRoomBtn.disabled = false;
    });
});


// ==========================================
// DOŁĄCZANIE DO POKOJU
// ==========================================

joinRoomBtn.addEventListener("click", function () {

    if (typeof Peer === "undefined") {
        alert("Nie udało się załadować PeerJS.");
        return;
    }

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

    joinRoomBtn.disabled = true;

    lobbyStatus.textContent =
        "Łączenie z pokojem...";

    console.log(
        "Próba dołączenia do:",
        roomCode
    );

    peer = new Peer({
        debug: 2
    });


    peer.on("open", function (myID) {

        console.log(
            "GUEST PEER OPEN:",
            myID
        );

        const hostID =
            "neon-casino-" +
            roomCode.toLowerCase();

        console.log(
            "Łączenie z hostem:",
            hostID
        );

        connection = peer.connect(
            hostID,
            {
                reliable: true,
                metadata: {
                    nickname: nickname
                }
            }
        );

        setupConnection();


        // Jeśli po 15 sekundach nadal brak połączenia
        setTimeout(function () {

            if (
                connection &&
                !connection.open
            ) {

                lobbyStatus.textContent =
                    "Nie udało się połączyć z pokojem.";

                joinRoomBtn.disabled = false;

                alert(
                    "Połączenie nie zostało nawiązane. Sprawdź kod pokoju i połączenie z internetem."
                );
            }

        }, 15000);
    });


    peer.on("disconnected", function () {

        console.log(
            "Guest PeerJS disconnected"
        );

        if (!peer.destroyed) {

            try {
                peer.reconnect();
            } catch (error) {
                console.error(error);
            }
        }
    });


    peer.on("error", function (error) {

        console.error(
            "GUEST PEER ERROR:",
            error
        );

        const type =
            error && error.type
                ? error.type
                : "unknown";

        lobbyStatus.textContent =
            "Błąd połączenia: " + type;

        joinRoomBtn.disabled = false;

        alert(
            "Błąd PeerJS: " + type
        );
    });
});


// ==========================================
// OBSŁUGA POŁĄCZENIA
// ==========================================

function setupConnection() {

    if (!connection) {
        return;
    }


    connection.on("open", function () {

        console.log(
            "DATA CONNECTION OPEN"
        );


        if (isHost) {

            setStatus(
                "Znajomy połączył się z pokojem."
            );
        }

        else {

            connection.send({
                type: "join",
                nickname: nickname
            });

            openGame();

            setStatus(
                "Połączono z pokojem!"
            );
        }
    });


    connection.on("data", function (data) {

        console.log(
            "ODEBRANO:",
            data
        );

        handleNetworkMessage(data);
    });


    connection.on("close", function () {

        console.log(
            "DATA CONNECTION CLOSED"
        );

        if (isHost) {

            setStatus(
                "Drugi gracz rozłączył się."
            );

            const hostPlayer =
                players[nickname];

            players = {};

            if (hostPlayer) {
                players[nickname] =
                    hostPlayer;
            }

            connection = null;

            renderEverything();
        }

        else {

            setStatus(
                "Połączenie z hostem zostało przerwane."
            );
        }
    });


    connection.on("error", function (error) {

        console.error(
            "CONNECTION ERROR:",
            error
        );

        const type =
            error && error.type
                ? error.type
                : "unknown";

        setStatus(
            "Błąd połączenia: " + type
        );

        alert(
            "Błąd połączenia: " + type
        );
    });
}


// ==========================================
// WIADOMOŚCI SIECIOWE
// ==========================================

function handleNetworkMessage(data) {

    if (!data || !data.type) {
        return;
    }


    // GRACZ DOŁĄCZYŁ

    if (
        data.type === "join" &&
        isHost
    ) {

        let guestName =
            String(
                data.nickname || "Gracz"
            ).substring(0, 20);


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

        renderEverything();

        setStatus(
            guestName +
            " dołączył do stołu!"
        );
    }


    // HOST POTWIERDZA NICK

    if (
        data.type === "joined" &&
        !isHost
    ) {

        nickname = data.nickname;

        setStatus(
            "Dołączyłeś do pokoju!"
        );
    }


    // SYNCHRONIZACJA

    if (
        data.type === "state" &&
        !isHost
    ) {

        players =
            data.players || {};

        pot =
            data.pot || [];

        renderEverything();
    }


    // ŻETONY GOŚCIA

    if (
        data.type === "bet-chips" &&
        isHost
    ) {

        const value =
            Number(data.value);


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


    // ITEM GOŚCIA

    if (
        data.type === "bet-item" &&
        isHost
    ) {

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


    // COFNIĘCIE STAWKI GOŚCIA

    if (
        data.type === "undo" &&
        isHost
    ) {

        pot = pot.filter(
            function (bet) {
                return (
                    bet.owner !==
                    data.nickname
                );
            }
        );


        broadcastState();
        renderEverything();
    }


    // POKÓJ PEŁNY

    if (data.type === "room-full") {

        alert(
            "Ten pokój jest już pełny."
        );

        location.reload();
    }
}


// ==========================================
// OTWIERANIE STOŁU
// ==========================================

function openGame() {

    roomCodeDisplay.textContent =
        roomCode;

    showScreen(gameScreen);

    renderEverything();
}


// ==========================================
// SYNCHRONIZACJA
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
// STAWIANIE ŻETONÓW
// ==========================================

document
    .querySelectorAll(".chip")
    .forEach(function (button) {

        button.addEventListener(
            "click",
            function () {

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

            renderBalance();

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
    .forEach(function (button) {

        button.addEventListener(
            "click",
            function () {

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
// WŁASNY WIRTUALNY ITEM
// ==========================================

document
    .getElementById("create-item-btn")
    .addEventListener(
        "click",
        function () {

            const name =
                prompt(
                    "Podaj nazwę WIRTUALNEGO itemu:"
                );


            if (!name) {
                return;
            }


            const valueText =
                prompt(
                    "Podaj jego wartość w wirtualnych żetonach:"
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
        }
    );


// ==========================================
// STAWIANIE ITEMÓW
// ==========================================

function betItem(itemID) {

    const index =
        inventory.findIndex(
            function (item) {
                return item.id === itemID;
            }
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

            renderEverything();

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
// COFNIJ STAWKĘ
// ==========================================

document
    .getElementById("undo-bet-btn")
    .addEventListener(
        "click",
        function () {

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
        }
    );


function restoreMyBets() {

    const myBets =
        pot.filter(
            function (bet) {
                return (
                    bet.owner ===
                    nickname
                );
            }
        );


    myBets.forEach(
        function (bet) {

            if (
                bet.type === "chips"
            ) {

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
        }
    );


    pot = pot.filter(
        function (bet) {
            return (
                bet.owner !==
                nickname
            );
        }
    );
}


function restoreGuestBetsLocally() {

    const myBets =
        pot.filter(
            function (bet) {
                return (
                    bet.owner ===
                    nickname
                );
            }
        );


    myBets.forEach(
        function (bet) {

            if (
                bet.type === "chips"
            ) {

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
        }
    );
}


// ==========================================
// WYŚWIETLANIE
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


    if (!names.includes(nickname)) {
        names.push(nickname);
    }


    names.forEach(
        function (name) {

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
        }
    );


    playersList.innerHTML = html;
}


function renderInventory() {

    if (inventory.length === 0) {

        inventoryBox.innerHTML = `
            <p style="color:#84948d">
                Brak itemów.
            </p>
        `;

        return;
    }


    let html = "";


    inventory.forEach(
        function (item) {

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
        }
    );


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


    pot.forEach(
        function (bet) {

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
        }
    );


    potBox.innerHTML = html;
}


// ==========================================
// KOPIOWANIE KODU
// ==========================================

copyRoomBtn.addEventListener(
    "click",
    async function () {

        try {

            await navigator.clipboard.writeText(
                roomCode
            );


            setStatus(
                "Kod pokoju skopiowany: " +
                roomCode
            );
        }

        catch (error) {

            prompt(
                "Skopiuj kod pokoju:",
                roomCode
            );
        }
    }
);


// ==========================================
// START
// ==========================================

renderBalance();
