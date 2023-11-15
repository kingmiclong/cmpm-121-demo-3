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
  location: leaflet.LatLngExpression;
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

const caches: Cache[] = [];

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
function makeCache(i: number, j: number) {
  const location = leaflet.latLng(
    MERRILL_CLASSROOM.lat + i * TILE_DEGREES,
    MERRILL_CLASSROOM.lng + j * TILE_DEGREES
  );

  const gridCoords = latLngToGrid(location.lat, location.lng);
  let numCoins = Math.floor(luck([i, j, "cacheValue"].toString()) * 100);
  const coins = createCoins(gridCoords, numCoins);

  const cache: Cache = { location, coins, marker: null };

  const updatePopupContent = () => {
    const container = document.createElement("div");
    container.innerHTML = `
      <div>Cache at "${i},${j}" with coins:</div>
      ${cache.coins.map((coin) => `<div>${coin.id}</div>`).join("")}
      <button id="collect">Collect</button>
      <button id="deposit">Deposit</button>
    `;

    if (container instanceof HTMLElement) {
      const collectButton =
        container.querySelector<HTMLButtonElement>("#collect");
      const depositButton =
        container.querySelector<HTMLButtonElement>("#deposit");

      // Event listener for collecting coins
      collectButton?.addEventListener("click", () => {
        player.coins += cache.coins.length; // Add number of coins to player's inventory
        cache.coins = []; // Cache is now empty
        updateStatusPanel();
        cache.marker?.setPopupContent(updatePopupContent()); // Update popup content
      });

      // Event listener for depositing coins
      depositButton?.addEventListener("click", () => {
        if (player.coins > 0) {
          const newCoins = createCoins(gridCoords, player.coins);
          cache.coins.push(...newCoins); // Add new coins to cache
          player.coins = 0; // Player now has 0 coins
          updateStatusPanel();
          cache.marker?.setPopupContent(updatePopupContent()); // Update popup content
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
  caches.push(cache);
}

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
