const steps = [
  "Projekt", "Estrich", "Dämmung", "Zusatzmittel", "Lohn / Gerät", "Ergebnis"
];

let currentStep = 1;
let serviceType = "withInsulation";
let surfaceType = "standard";

const € = (n) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n || 0);
const fmt = (n, d = 2) => new Intl.NumberFormat("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n || 0);
const val = (id) => Number(document.getElementById(id)?.value || 0);

function init() {
  renderStepList();
  bindEvents();
  updatePanels();
  calculate();
}

function renderStepList() {
  const list = document.getElementById("stepList");
  list.innerHTML = steps.map((label, index) => `
    <div class="step-item clickable ${index + 1 === currentStep ? "active" : ""}" data-step="${index + 1}">
      <span class="step-number">${index + 1}</span>
      <span>${label}</span>
    </div>
  `).join("");
}

function bindEvents() {
  document.querySelectorAll("input, select").forEach(el => el.addEventListener("input", calculate));

  document.getElementById("nextBtn").addEventListener("click", () => {
    if (currentStep < steps.length) currentStep++;
    updatePanels();
  });
  document.getElementById("prevBtn").addEventListener("click", () => {
    if (currentStep > 1) currentStep--;
    updatePanels();
  });
  document.getElementById("calcBtn").addEventListener("click", calculate);
  document.getElementById("backToEditBtn").addEventListener("click", () => { currentStep = 1; updatePanels(); });
  document.getElementById("resetBtn").addEventListener("click", () => location.reload());

  document.getElementById("stepList").addEventListener("click", (e) => {
    const item = e.target.closest(".step-item");
    if (!item) return;
    currentStep = Number(item.dataset.step);
    updatePanels();
  });

  document.querySelectorAll("[data-service]").forEach(card => {
    card.addEventListener("click", () => {
      serviceType = card.dataset.service;
      document.querySelectorAll("[data-service]").forEach(c => c.classList.remove("active"));
      card.classList.add("active");
      updateInsulationState();
      calculate();
    });
  });

  document.querySelectorAll("[data-surface]").forEach(card => {
    card.addEventListener("click", () => {
      surfaceType = card.dataset.surface;
      document.querySelectorAll("[data-surface]").forEach(c => c.classList.remove("active"));
      card.classList.add("active");
      document.getElementById("surfaceBlock").classList.toggle("hidden", surfaceType !== "smoothed");
      calculate();
    });
  });
}

function updatePanels() {
  document.querySelectorAll(".step-panel").forEach(panel => {
    panel.classList.toggle("active", Number(panel.dataset.stepPanel) === currentStep);
  });
  document.getElementById("prevBtn").disabled = currentStep === 1;
  document.getElementById("nextBtn").textContent = currentStep === steps.length ? "Berechnung aktualisieren" : "Weiter";
  renderStepList();
  updateInsulationState();
  calculate();
}

function updateInsulationState() {
  const block = document.getElementById("insulationBlock");
  block.classList.toggle("disabled-block", serviceType === "screedOnly");
}

function calculate() {
  const area = Math.max(val("area"), 0);
  const workers = Math.max(val("workers"), 1);

  const screedMaterial = area * (val("screedThickness") / 10) * val("screedRate10mm") * (1 + val("screedWaste") / 100);
  const insulationMaterial = serviceType === "withInsulation"
    ? area * (val("insulationThickness") / 10) * val("insulationRate10mm") * (1 + val("insulationWaste") / 100)
    : 0;
  const foilEdge = serviceType === "withInsulation" ? area * (val("foilRate") + val("edgeRate")) : 0;

  const additive = area * (
    (document.getElementById("additiveFast").checked ? val("additiveFastRate") : 0) +
    (document.getElementById("additiveFiber").checked ? val("additiveFiberRate") : 0) +
    (document.getElementById("additiveFluid").checked ? val("additiveFluidRate") : 0)
  );
  const surface = surfaceType === "smoothed" ? area * val("surfaceSurcharge") : 0;

  const screedHours = area / (workers * Math.max(val("screedProductivity"), 1));
  const insulationHours = serviceType === "withInsulation" ? area / (workers * Math.max(val("insulationProductivity"), 1)) : 0;
  const totalHours = screedHours + insulationHours;
  const labor = totalHours * workers * val("hourlyRate");

  const pump = area * val("pumpRate");
  const travel = val("distanceKm") * 2 * val("travelRateKm");
  const setup = val("setupCost");
  const smallSite = area > 0 && area <= val("smallSiteLimit") ? val("smallSiteSurcharge") : 0;

  const direct = screedMaterial + insulationMaterial + foilEdge + additive + surface + labor + pump + travel + setup + smallSite;
  const overhead = direct * val("overheadPercent") / 100;
  const profit = (direct + overhead) * val("profitPercent") / 100;
  const total = direct + overhead + profit;
  const priceM2 = area > 0 ? total / area : 0;

  const data = { area, screedMaterial, insulationMaterial, foilEdge, additive, surface, labor, pump, travel, setup, smallSite, direct, overhead, profit, total, priceM2, totalHours };
  renderSummary(data);
  renderFinal(data);
}

function renderSummary(d) {
  document.getElementById("summaryBox").innerHTML = `
    <div class="summary-box calc-box">
      <strong>${€(d.total)} netto</strong>
      <div>${fmt(d.priceM2)} €/m² netto</div>
    </div>
    <div class="summary-box">
      <strong>Projekt</strong>
      <div class="summary-compact-grid">
        <div class="summary-compact-item"><span>Fläche</span><b>${fmt(d.area, 0)} m²</b></div>
        <div class="summary-compact-item"><span>Leistung</span><b>${serviceType === "withInsulation" ? "mit Dämmung" : "nur Estrich"}</b></div>
        <div class="summary-compact-item"><span>Stunden</span><b>${fmt(d.totalHours)} h Kolonne</b></div>
      </div>
    </div>
    <div class="summary-box">
      <strong>Kostenblöcke</strong>
      <span class="tag">Material ${€(d.screedMaterial + d.insulationMaterial + d.foilEdge)}</span>
      <span class="tag">Lohn ${€(d.labor)}</span>
      <span class="tag">Gerät ${€(d.pump)}</span>
      <span class="tag">GK/Gewinn ${€(d.overhead + d.profit)}</span>
    </div>
  `;
}

function renderFinal(d) {
  const rows = [
    ["Estrichmaterial", d.screedMaterial, `Dicke ${val("screedThickness")} mm`],
    ["Dämmung", d.insulationMaterial, serviceType === "withInsulation" ? `Dicke ${val("insulationThickness")} mm` : "nicht berechnet"],
    ["Folie / Randdämmstreifen", d.foilEdge, serviceType === "withInsulation" ? "Nebenmaterial" : "nicht berechnet"],
    ["Zusatzmittel", d.additive, "aktivierte Zuschläge"],
    ["Oberfläche", d.surface, surfaceType === "smoothed" ? "verbesserte Oberfläche" : "Standard"],
    ["Lohn", d.labor, `${fmt(d.totalHours)} h Kolonne`],
    ["Estrichpumpe / Gerät", d.pump, `${fmt(val("pumpRate"))} €/m²`],
    ["Anfahrt", d.travel, `${val("distanceKm")} km einfache Strecke`],
    ["Baustelleneinrichtung", d.setup, "Pauschale"],
    ["Kleinstellenzuschlag", d.smallSite, d.smallSite > 0 ? "aktiv" : "nicht aktiv"],
    ["Gemeinkosten", d.overhead, `${fmt(val("overheadPercent"))} %`],
    ["Gewinn / Sicherheit", d.profit, `${fmt(val("profitPercent"))} %`]
  ];

  document.getElementById("finalResult").innerHTML = `
    <div class="technical-grid">
      <div><span>Projekt</span><strong>${document.getElementById("projectName").value || "-"}</strong></div>
      <div><span>Leistung</span><strong>${serviceType === "withInsulation" ? "Komplettleistung inkl. Dämmung" : "Nur Estrich"}</strong></div>
      <div><span>Gesamt netto</span><strong>${€(d.total)}</strong></div>
      <div><span>m²-Preis netto</span><strong>${fmt(d.priceM2)} €/m²</strong></div>
    </div>
    <div class="result-table-wrap">
      <table class="result-table">
        <thead><tr><th>Kostenposition</th><th>Hinweis</th><th>Betrag</th></tr></thead>
        <tbody>${rows.map(r => `<tr><td>${r[0]}</td><td>${r[2]}</td><td>${€(r[1])}</td></tr>`).join("")}</tbody>
        <tfoot><tr><th colspan="2">Gesamt netto</th><th>${€(d.total)}</th></tr></tfoot>
      </table>
    </div>
    <p class="result-price-note">Hinweis: Demo-Kalkulation ohne technische Prüfung. Preise und Leistungswerte müssen durch echte NDF-Erfahrungswerte ersetzt werden.</p>
  `;
}

document.addEventListener("DOMContentLoaded", init);
