// ================== Data: Emission Factors (kg CO2 per passenger-km) ==================
const EMISSION_FACTORS = {
  walk: 0,           // Walking
  cycle: 0,          // Cycling
  bus: 0.105,        // City bus (per person)
  metro: 0.041,      // Metro / electric train
  bike: 0.103,       // Motorbike
  car: 0.192,        // Solo petrol car
  carpool: 0.192 / 3, // Car shared by ~3 people
  evCar: 0.05,       // Electric car
  flight: 0.255      // Short flight
};

const MODE_META = {
  walk: {
    label: "Walking",
    icon: "🚶",
    description: "Best for short distances. Zero emissions and great for health."
  },
  cycle: {
    label: "Cycling",
    icon: "🚴",
    description: "Perfect for short to medium distances with near-zero emissions."
  },
  bus: {
    label: "Bus",
    icon: "🚌",
    description: "Good for city travel with low emissions per passenger."
  },
  metro: {
    label: "Metro / Train",
    icon: "🚆",
    description: "One of the cleanest options for medium and long distances."
  },
  bike: {
    label: "Motorbike",
    icon: "🏍️",
    description: "Better than a car for a single person, but not as green as public transport."
  },
  car: {
    label: "Car (Solo Petrol)",
    icon: "🚗",
    description: "High emissions when travelling alone. Use only if necessary."
  },
  carpool: {
    label: "Car-pool",
    icon: "🚘",
    description: "Sharing the ride cuts emissions and cost per person."
  },
  evCar: {
    label: "Electric Car",
    icon: "🚙",
    description: "Much lower emissions than petrol, especially when grid is clean."
  },
  flight: {
    label: "Flight",
    icon: "✈️",
    description: "Very high emissions. Try to avoid for short distances."
  }
};

// ================== Helpers ==================
function roundTo(value, decimals = 2) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function computeModes(distanceKm, purpose) {
  const modes = [];

  // Decide which modes are relevant based on distance
  const entries = Object.entries(EMISSION_FACTORS);

  for (const [key, factor] of entries) {
    // Filter unrealistic options by distance / purpose
    if (distanceKm < 1 && (key === "bus" || key === "metro" || key === "flight")) continue;
    if (distanceKm < 2 && key === "flight") continue;
    if (distanceKm < 3 && key === "metro") continue;

    if (distanceKm < 5 && key === "flight") continue;
    if (distanceKm < 10 && purpose === "daily" && key === "flight") continue;

    // For long journeys, encourage train/flight, not walking/cycling (but still display)
    const emissionKg = roundTo(factor * distanceKm, 3); // kg CO2
    modes.push({
      key,
      label: MODE_META[key].label,
      icon: MODE_META[key].icon,
      description: MODE_META[key].description,
      emissionKg
    });
  }

  // Find max emission for scoring (ignore zero modes)
  const nonZero = modes.filter(m => m.emissionKg > 0);
  const maxEmission = nonZero.length
    ? Math.max(...nonZero.map(m => m.emissionKg))
    : 1;

  // Calculate green score (0–100, higher is better)
  modes.forEach(m => {
    if (m.emissionKg === 0) {
      m.greenScore = 100;
    } else {
      const ratio = m.emissionKg / maxEmission; // 0..1
      const score = 100 - ratio * 80;           // keep some range
      m.greenScore = Math.max(20, roundTo(score, 0));
    }
  });

  // Sort by emission ascending
  modes.sort((a, b) => a.emissionKg - b.emissionKg);

  return modes;
}

function classifyScore(score) {
  if (score >= 85) return { label: "Excellent", emoji: "🌟" };
  if (score >= 70) return { label: "Good", emoji: "✅" };
  if (score >= 55) return { label: "Ok", emoji: "⚖️" };
  return { label: "Could be greener", emoji: "⚠️" };
}

function classifyTrip(distanceKm) {
  if (distanceKm <= 2) return "Very short (ideal for walking/cycling)";
  if (distanceKm <= 8) return "Short city trip";
  if (distanceKm <= 30) return "Medium city / town trip";
  return "Long distance trip";
}

// Save / load recent trips in localStorage
const STORAGE_KEY = "green_travel_recent_trips_v1";

function loadRecentTrips() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data;
  } catch {
    return [];
  }
}

function saveRecentTrip(trip) {
  const current = loadRecentTrips();
  current.unshift(trip);
  const trimmed = current.slice(0, 6);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  return trimmed;
}

// ================== UI Rendering ==================
function renderResults(modes, distanceKm, from, to, purpose) {
  const resultsSection = document.getElementById("results");
  const resultsSummary = document.getElementById("resultsSummary");
  const resultsGrid = document.getElementById("resultsGrid");
  const statsPanel = document.getElementById("statsPanel");
  const heroScoreEl = document.getElementById("heroScore");
  const heroTipEl = document.getElementById("heroTip");

  if (!resultsSection || !resultsSummary || !resultsGrid || !statsPanel) return;

  if (!modes.length) {
    resultsSection.classList.add("hidden");
    return;
  }

  resultsSection.classList.remove("hidden");

  const best = modes[0];
  const worst = modes[modes.length - 1];

  const averageScore =
    modes.reduce((sum, m) => sum + m.greenScore, 0) / modes.length;

  const tripTypeText = classifyTrip(distanceKm);

  resultsSummary.textContent = `For a ${distanceKm} km ${tripTypeText.toLowerCase()}, the greenest option is ${
    best.label
  } (${roundTo(best.emissionKg, 2)} kg CO₂). ${
    worst.label
  } emits the most (${roundTo(worst.emissionKg, 2)} kg CO₂).`;

  // Hero score update
  const scoreClass = classifyScore(best.greenScore);
  heroScoreEl.textContent = best.greenScore;
  heroTipEl.textContent = `${scoreClass.emoji} Best choice: ${best.label} • ${scoreClass.label} for this distance.`;

  // Mode cards
  resultsGrid.innerHTML = "";
  const maxEmission = modes.reduce(
    (max, m) => (m.emissionKg > max ? m.emissionKg : max),
    1
  );

  modes.forEach((mode, index) => {
    const percentage =
      mode.emissionKg === 0 ? 15 : Math.max(10, (mode.emissionKg / maxEmission) * 100);

    const scoreInfo = classifyScore(mode.greenScore);
    const isBest = index === 0;

    const card = document.createElement("article");
    card.className = "mode-card" + (isBest ? " best" : "");

    card.innerHTML = `
      <div class="mode-header">
        <div class="mode-title">
          <span class="mode-icon">${mode.icon}</span>
          <span>${mode.label}</span>
        </div>
        <div>
          ${
            isBest
              ? '<span class="badge">Top choice</span>'
              : `<span class="rank-number">#${index + 1}</span>`
          }
        </div>
      </div>
      <div class="mode-body">
        <p>${mode.description}</p>
        <div class="emission-row">
          <span>Estimated emissions</span>
          <span class="emission-value">${roundTo(
            mode.emissionKg,
            3
          )} kg CO₂</span>
        </div>
        <div class="emission-bar">
          <div class="emission-bar-inner" style="width: ${percentage}%;"></div>
        </div>
        <div class="score-tag">
          <span>${scoreInfo.emoji}</span>
          <span>${mode.greenScore}/100</span>
          <span>• ${scoreInfo.label}</span>
        </div>
      </div>
    `;

    resultsGrid.appendChild(card);
  });

  // Stats panel
  const carMode = modes.find(m => m.key === "car");
  const busMode = modes.find(m => m.key === "bus" || m.key === "metro");

  let savedText = "—";
  if (carMode && busMode) {
    const saved = carMode.emissionKg - busMode.emissionKg;
    savedText =
      saved > 0
        ? `${roundTo(saved, 2)} kg CO₂ saved by using ${busMode.label} instead of solo car`
        : "Using car here is not the worst, but greener options exist.";
  }

  statsPanel.innerHTML = `
    <div class="stat-box">
      <span class="stat-label">Trip</span>
      <span class="stat-value">${from} → ${to}</span>
    </div>
    <div class="stat-box">
      <span class="stat-label">Distance & type</span>
      <span class="stat-value">${distanceKm} km • ${tripTypeText}</span>
    </div>
    <div class="stat-box">
      <span class="stat-label">Purpose</span>
      <span class="stat-value">${
        purpose === "daily"
          ? "Daily commute"
          : purpose === "casual"
          ? "Casual outing"
          : purpose === "work"
          ? "Work / Business"
          : "Long journey"
      }</span>
    </div>
    <div class="stat-box">
      <span class="stat-label">Average green score</span>
      <span class="stat-value">${roundTo(averageScore, 1)} / 100</span>
    </div>
    <div class="stat-box">
      <span class="stat-label">Potential benefit</span>
      <span class="stat-value">${savedText}</span>
    </div>
  `;

  // Scroll into view (nice for mobile)
  resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Render recent trips section
function renderRecentTrips(list) {
  const section = document.getElementById("recentTrips");
  const container = document.getElementById("recentList");
  if (!section || !container) return;

  if (!list.length) {
    section.classList.add("hidden");
    return;
  }

  section.classList.remove("hidden");
  container.innerHTML = "";

  list.forEach(trip => {
    const item = document.createElement("div");
    item.className = "recent-item";
    item.innerHTML = `
      <div class="recent-item-main">
        <span>${trip.from} → ${trip.to}</span>
        <span>${trip.bestLabel}</span>
      </div>
      <div class="recent-distance">${trip.distance} km • ${trip.tripType}</div>
      <div class="recent-meta">
        <span>${trip.purposeLabel}</span>
        <span>${roundTo(trip.bestEmission, 2)} kg CO₂</span>
      </div>
    `;
    container.appendChild(item);
  });
}

// ================== Theme Toggle ==================
function initThemeToggle() {
  const btn = document.getElementById("themeToggle");
  if (!btn) return;

  const savedTheme = localStorage.getItem("green_travel_theme");
  if (savedTheme === "light") {
    document.body.classList.add("light");
    btn.textContent = "🌙";
  }

  btn.addEventListener("click", () => {
    document.body.classList.toggle("light");
    const isLight = document.body.classList.contains("light");
    btn.textContent = isLight ? "🌙" : "☀️";
    localStorage.setItem("green_travel_theme", isLight ? "light" : "dark");
  });
}

// ================== Init ==================
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("tripForm");
  const distanceInput = document.getElementById("distanceInput");
  const fromInput = document.getElementById("fromInput");
  const toInput = document.getElementById("toInput");
  const purposeSelect = document.getElementById("purposeSelect");

  initThemeToggle();

  // Load previous trips
  const existingTrips = loadRecentTrips();
  renderRecentTrips(existingTrips);

  if (!form || !distanceInput || !fromInput || !toInput || !purposeSelect) return;

  form.addEventListener("submit", event => {
    event.preventDefault();

    const from = fromInput.value.trim() || "Unknown";
    const to = toInput.value.trim() || "Unknown";
    const purpose = purposeSelect.value || "daily";

    const distance = parseFloat(distanceInput.value);
    if (Number.isNaN(distance) || distance <= 0) {
      alert("Please enter a valid positive distance in km.");
      return;
    }

    const distanceKm = roundTo(distance, 2);

    const modes = computeModes(distanceKm, purpose);
    renderResults(modes, distanceKm, from, to, purpose);

    if (modes.length) {
      const best = modes[0];
      const tripType = classifyTrip(distanceKm);
      const purposeLabel =
        purpose === "daily"
          ? "Daily commute"
          : purpose === "casual"
          ? "Casual outing"
          : purpose === "work"
          ? "Work / Business"
          : "Long journey";

      const newList = saveRecentTrip({
        from,
        to,
        distance: distanceKm,
        bestLabel: best.label,
        bestEmission: best.emissionKg,
        tripType,
        purposeLabel
      });

      renderRecentTrips(newList);
    }
  });
});
