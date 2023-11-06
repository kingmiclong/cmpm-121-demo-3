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
interface Cache {
  location: leaflet.LatLngExpression;
  marker: leaflet.Marker;
  coins: number;
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

// Function to create a cache
function makeCache(i: number, j: number) {
  const location = leaflet.latLng(
    MERRILL_CLASSROOM.lat + i * TILE_DEGREES,
    MERRILL_CLASSROOM.lng + j * TILE_DEGREES
  );

  let coins = Math.floor(luck([i, j, "cacheValue"].toString()) * 100);

  const marker = leaflet.marker(location);
  marker.bindPopup(() => {
    const container = document.createElement("div");
    container.innerHTML = `
      <div>Cache at "${i},${j}" with ${coins} coins.</div>
      <button id="collect">Collect</button>
      <button id="deposit">Deposit</button>
    `;
    const collectButton =
      container.querySelector<HTMLButtonElement>("#collect")!;
    const depositButton =
      container.querySelector<HTMLButtonElement>("#deposit")!;

    // Event listener for collecting coins
    collectButton.addEventListener("click", () => {
      player.coins += coins; // Add coins to player's inventory
      coins = 0; // Cache is now empty
      updateStatusPanel();
      marker.getPopup()?.setContent(container.innerHTML); // Update popup content
    });

    // Event listener for depositing coins
    depositButton.addEventListener("click", () => {
      if (player.coins > 0) {
        coins += player.coins; // Add player's coins to cache
        player.coins = 0; // Player now has 0 coins
        updateStatusPanel();
        marker.getPopup()?.setContent(container.innerHTML); // Update popup content
      }
    });

    return container;
  });
  marker.addTo(map);

  // Add the cache to the caches array
  caches.push({ location, marker, coins });
}

// Generate caches
for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
  for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
    if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
      makeCache(i, j);
    }
  }
}

// Initial call to update the status panel
updateStatusPanel();
