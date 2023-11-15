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
  const i = Math.floor((lat + 90) * 10000);
  const j = Math.floor((lng + 180) * 10000);
  return { i, j };
}

// Create coins
function createCoins(
  gridCoords: { i: number; j: number },
  numCoins: number
): Coin[] {
  return Array.from({ length: numCoins }, (_, serial) => ({
    id: `${gridCoords.i}:${gridCoords.j}#${serial}`,
    value: 1, // Or any other value logic
  }));
}

// Function to create a cache
function makeCache(i: number, j: number, isNew: boolean = true) {
  const latOffset = player.location.lat + i * TILE_DEGREES;
  const lngOffset = player.location.lng + j * TILE_DEGREES;
  const location = leaflet.latLng(latOffset, lngOffset);

  const gridCoords = latLngToGrid(location.lat, location.lng);
  let numCoins = Math.floor(luck([i, j, "cacheValue"].toString()) * 100);
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
    buttonsContainer.innerHTML = `
      <button id="collect">Collect</button>
      <button id="deposit">Deposit</button>
    `;
    container.appendChild(buttonsContainer);

    if (container instanceof HTMLElement) {
      const collectButton =
        container.querySelector<HTMLButtonElement>("#collect");
      const depositButton =
        container.querySelector<HTMLButtonElement>("#deposit");

      collectButton?.addEventListener("click", () => {
        player.coins += cache.coins.length;
        cache.coins = [];
        updateStatusPanel();
        cache.marker?.setPopupContent(updatePopupContent());
      });

      depositButton?.addEventListener("click", () => {
        if (player.coins > 0) {
          const newCoins = createCoins(gridCoords, player.coins);
          cache.coins.push(...newCoins);
          player.coins = 0;
          updateStatusPanel();
          cache.marker?.setPopupContent(updatePopupContent());
        }
      });
    }

    return container;
  };

  const marker = leaflet
    .marker(location)
    .bindPopup(updatePopupContent)
    .addTo(map);
  cache.marker = marker;
  if (isNew) {
    caches.push(cache);
  }
}

// Functions for check and geenrate Caches
function checkAndGenerateCaches() {
  // Get the player's current grid location
  const playerGrid = latLngToGrid(player.location.lat, player.location.lng);

  // Determine which caches are out of range and hide their markers
  caches.forEach((cache) => {
    const cacheGrid = latLngToGrid(cache.location.lat, cache.location.lng);
    if (
      Math.abs(cacheGrid.i - playerGrid.i) +
        Math.abs(cacheGrid.j - playerGrid.j) >
      NEIGHBORHOOD_SIZE
    ) {
      if (cache.marker) {
        cache.marker.remove(); // Hide the marker from the map
      }
    } else {
      if (cache.marker && !map.hasLayer(cache.marker)) {
        cache.marker.addTo(map); // Re-add the marker to the map if it's within range
      }
    }
  });

  // Generate new caches if necessary
  for (let i = -NEIGHBORHOOD_SIZE; i <= NEIGHBORHOOD_SIZE; i++) {
    for (let j = -NEIGHBORHOOD_SIZE; j <= NEIGHBORHOOD_SIZE; j++) {
      const cacheCoords = { i: playerGrid.i + i, j: playerGrid.j + j };
      const alreadyExists = caches.some((cache) => {
        const gridCoords = latLngToGrid(cache.location.lat, cache.location.lng);
        return (
          gridCoords.i === cacheCoords.i &&
          gridCoords.j === cacheCoords.j &&
          cache.coins.length > 0
        );
      });

      if (
        !alreadyExists &&
        luck([cacheCoords.i, cacheCoords.j].toString()) <
          CACHE_SPAWN_PROBABILITY
      ) {
        makeCache(i, j); // Add the new cache, marking it as a new cache
      }
    }
  }
}

// requirement cachememento
class CacheMemento {
  constructor(public state: Cache[]) {}
}

let savedState: CacheMemento;

// save caches
function saveCachesState() {
  savedState = new CacheMemento([...caches]);
}

// restore caches
function restoreCachesState() {
  if (savedState) {
    caches = savedState.state;
    caches.forEach((cache) => {
      if (cache.marker && !map.hasLayer(cache.marker)) {
        cache.marker.addTo(map);
      }
    });
  }
}

// Function for moving player
function movePlayer(latChange: number, lngChange: number) {
  saveCachesState();
  player.location = leaflet.latLng(
    player.location.lat + latChange,
    player.location.lng + lngChange
  );
  player.marker.setLatLng(player.location);
  map.panTo(player.location);
  restoreCachesState();
  checkAndGenerateCaches();
  updateStatusPanel();
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

// Initial call to update the status panel
updateStatusPanel();
