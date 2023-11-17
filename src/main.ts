import "leaflet/dist/leaflet.css";
import "./style.css";
import leaflet from "leaflet";
import luck from "./luck";
import "./leafletWorkaround";

const MERRILL_CLASSROOM = leaflet.latLng({
  lat: 36.9995,
  lng: -122.0533,
});

const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;

const mapContainer = document.querySelector<HTMLElement>("#map")!;
const map = leaflet.map(mapContainer, {
  center: MERRILL_CLASSROOM,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

// Define the player inventory and cache structure
interface Coin {
  id: string;
  value: number;
}

interface Cache {
  location: leaflet.LatLng; // Changed from LatLngExpression to LatLng
  marker: leaflet.Marker | null;
  coins: Coin[];
}

const player = {
  location: MERRILL_CLASSROOM,
  coins: 0, // Player starts with 0 coins
  marker: leaflet
    .marker(MERRILL_CLASSROOM)
    .addTo(map)
    .bindTooltip("That's you!"),
};

let caches: Cache[] = [];

// Update the status panel function
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
const updateStatusPanel = () => {
  statusPanel.innerHTML = `You have ${player.coins} coins.`;
};

// Function to convert lat-lng to grid
function latLngToGrid(lat: number, lng: number): { i: number; j: number } {
  return {
    i: Math.floor((lat + 90) * 10000),
    j: Math.floor((lng + 180) * 10000),
  };
}

// Create coins
function createCoins(
  gridCoords: { i: number; j: number },
  numCoins: number
): Coin[] {
  return Array.from({ length: numCoins }, (_, serial) => ({
    id: `${gridCoords.i}:${gridCoords.j}#${serial}`,
    value: 1,
  }));
}

// Create coin locations
function makeCache(i: number, j: number) {
  const latOffset = player.location.lat + i * TILE_DEGREES;
  const lngOffset = player.location.lng + j * TILE_DEGREES;
  const location = leaflet.latLng(latOffset, lngOffset);

  const gridCoords = latLngToGrid(location.lat, location.lng);
  const numCoins = Math.floor(luck([i, j, "cacheValue"].toString()) * 100);
  const coins = createCoins(gridCoords, numCoins);

  const cache: Cache = { location, coins, marker: null };

  const updatePopupContent = () => {
    const container = document.createElement("div");
    const coinListContainer = document.createElement("div");
    coinListContainer.style.maxHeight = "150px";
    coinListContainer.style.overflowY = "auto";
    coinListContainer.innerHTML = cache.coins
      .map((coin) => `<div>${coin.id}</div>`)
      .join("");

    container.appendChild(coinListContainer);

    const buttonsContainer = document.createElement("div");
    buttonsContainer.innerHTML = `<button id="collect">Collect</button><button id="deposit">Deposit</button>`;
    container.appendChild(buttonsContainer);

    container.querySelectorAll(".coin").forEach((coinDiv) => {
      coinDiv.addEventListener("click", () => {
        const coinId = coinDiv.getAttribute("data-coin-id");
        if (coinId) {
          onCoinClick(coinId);
        } else {
          console.error("Coin ID is null.");
        }
      });
    });

    return container;
  };

  cache.marker = leaflet
    .marker(location)
    .bindPopup(updatePopupContent())
    .addTo(map);
  caches.push(cache);
}

const locateButton = document.getElementById("sensor") as HTMLButtonElement;
locateButton.addEventListener("click", function () {
  map.locate({ setView: true, maxZoom: GAMEPLAY_ZOOM_LEVEL });
});

map.on("locationfound", function (e) {
  movePlayer(
    e.latlng.lat - player.location.lat,
    e.latlng.lng - player.location.lng
  );
});

let movementHistory = leaflet.polyline([], { color: "blue" }).addTo(map);

// Check the surrounding and generate
function checkAndGenerateCaches() {
  const playerGrid = latLngToGrid(player.location.lat, player.location.lng);

  caches = caches.filter((cache) => {
    const cacheGrid = latLngToGrid(cache.location.lat, cache.location.lng);
    const outOfRange =
      Math.abs(cacheGrid.i - playerGrid.i) +
        Math.abs(cacheGrid.j - playerGrid.j) >
      NEIGHBORHOOD_SIZE;
    if (outOfRange && cache.marker) {
      cache.marker.remove();
    }
    return !outOfRange;
  });

  for (let i = -NEIGHBORHOOD_SIZE; i <= NEIGHBORHOOD_SIZE; i++) {
    for (let j = -NEIGHBORHOOD_SIZE; j <= NEIGHBORHOOD_SIZE; j++) {
      const cacheCoords = { i: playerGrid.i + i, j: playerGrid.j + j };
      const alreadyExists = caches.some(
        (cache) =>
          latLngToGrid(cache.location.lat, cache.location.lng).i ===
            cacheCoords.i &&
          latLngToGrid(cache.location.lat, cache.location.lng).j ===
            cacheCoords.j
      );
      if (
        !alreadyExists &&
        luck([cacheCoords.i, cacheCoords.j].toString()) <
          CACHE_SPAWN_PROBABILITY
      ) {
        makeCache(i, j);
      }
    }
  }
}

// Momento
class CacheMemento {
  constructor(public state: Cache[]) {}
}

let savedState: CacheMemento;

function saveCachesState() {
  savedState = new CacheMemento(caches.map((cache) => ({ ...cache })));
}

// Restore back the state of previous visited cache
function restoreCachesState() {
  if (savedState) {
    caches = savedState.state;
    caches.forEach((cache) => {
      if (cache.marker) {
        map.addLayer(cache.marker);
      }
    });
  }
}

// Player movement
function movePlayer(latChange: number, lngChange: number) {
  saveCachesState();
  const newLat = player.location.lat + latChange;
  const newLng = player.location.lng + lngChange;
  player.location = leaflet.latLng(newLat, newLng);
  player.marker.setLatLng(player.location);
  map.panTo(player.location);
  restoreCachesState();
  checkAndGenerateCaches();
  updateStatusPanel();
  movementHistory.addLatLng(player.location);
}

// Link the buttons
const northButton = document.getElementById("north") as HTMLButtonElement;
const southButton = document.getElementById("south") as HTMLButtonElement;
const westButton = document.getElementById("west") as HTMLButtonElement;
const eastButton = document.getElementById("east") as HTMLButtonElement;

// EventListener for buttons
northButton.addEventListener("click", () => movePlayer(TILE_DEGREES, 0));
southButton.addEventListener("click", () => movePlayer(-TILE_DEGREES, 0));
westButton.addEventListener("click", () => movePlayer(0, -TILE_DEGREES));
eastButton.addEventListener("click", () => movePlayer(0, TILE_DEGREES));

// Generate caches
for (let i = -NEIGHBORHOOD_SIZE; i <= NEIGHBORHOOD_SIZE; i++) {
  for (let j = -NEIGHBORHOOD_SIZE; j <= NEIGHBORHOOD_SIZE; j++) {
    if (
      Math.abs(i) + Math.abs(j) <= NEIGHBORHOOD_SIZE &&
      luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY
    ) {
      makeCache(i, j);
    }
  }
}

// Save the state of the game for movement
function saveGameState() {
  localStorage.setItem("player-coins", JSON.stringify(player.coins));
  localStorage.setItem("player-location", JSON.stringify(player.location));
  localStorage.setItem(
    "movement-history",
    JSON.stringify(movementHistory.getLatLngs())
  );
}

// Load the state of game for initial and set
function loadGameState() {
  const savedCoins = localStorage.getItem("player-coins");
  const savedLocation = localStorage.getItem("player-location");
  const savedHistory = localStorage.getItem("movement-history");

  if (savedCoins) player.coins = JSON.parse(savedCoins);
  if (savedLocation) {
    const latLng = JSON.parse(savedLocation);
    player.location = leaflet.latLng(latLng);
    player.marker.setLatLng(player.location);
    map.setView(player.location, GAMEPLAY_ZOOM_LEVEL);
  }
  if (savedHistory) {
    const latLngs = JSON.parse(savedHistory);
    movementHistory.setLatLngs(latLngs);
  }
  updateStatusPanel();
}

window.addEventListener("load", loadGameState);

const resetButton = document.getElementById("reset") as HTMLButtonElement;
resetButton.addEventListener("click", function () {
  if (window.confirm("Are you sure you want to reset your game state?")) {
    player.coins = 0;
    movementHistory.setLatLngs([]);
    player.location = MERRILL_CLASSROOM;
    player.marker.setLatLng(player.location);
    map.setView(player.location, GAMEPLAY_ZOOM_LEVEL);
    caches.forEach((cache) => (cache.coins = []));
    saveGameState();
    updateStatusPanel();
  }
});

// Click coin
function onCoinClick(coinId: string) {
  centerMapOnCache(coinId);
}

// Center the cache
function centerMapOnCache(cacheId: string) {
  const cache = caches.find((c) => c.coins.some((coin) => coin.id === cacheId));
  if (cache && cache.location) {
    map.setView(cache.location, GAMEPLAY_ZOOM_LEVEL);
  }
}
