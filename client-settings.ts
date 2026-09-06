/** Local preference loading, persistence, and accessible key binding controls. */
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const keyDefaults = {
  forward: "KeyW",
  back: "KeyS",
  left: "KeyA",
  right: "KeyD",
  run: "ShiftLeft",
  crouch: "KeyC",
  interact: "KeyE",
  use: "KeyQ",
  drop: "KeyG",
  ping: "KeyF",
  notebook: "Tab",
};
export type Keys = typeof keyDefaults;
export type Settings = {
  sensitivity: number;
  invert: boolean;
  volume: number;
  keys: Keys;
};
export const settings: Settings = {
  sensitivity: 1,
  invert: false,
  volume: 0.5,
  keys: { ...keyDefaults },
};
try {
  const stored = JSON.parse(localStorage.getItem("wu-settings") ?? "null");
  if (stored) {
    settings.sensitivity = Math.max(
      0.3,
      Math.min(3, Number(stored.sensitivity) || 1),
    );
    settings.invert = !!stored.invert;
    settings.volume = Math.max(0, Math.min(1, Number(stored.volume) || 0));
    for (const key of Object.keys(keyDefaults) as (keyof Keys)[])
      if (typeof stored.keys?.[key] === "string")
        settings.keys[key] = stored.keys[key];
  }
} catch {
  /* Corrupt local preferences never block admission. */
}
function saveSettings() {
  localStorage.setItem("wu-settings", JSON.stringify(settings));
}
export function setupSettings() {
  $<HTMLInputElement>("sensitivity").value = String(settings.sensitivity);
  $<HTMLInputElement>("invert").checked = settings.invert;
  $<HTMLInputElement>("volume").value = String(settings.volume);
  for (const id of ["sensitivity", "invert", "volume"])
    $(id).onchange = () => {
      settings.sensitivity = Number($<HTMLInputElement>("sensitivity").value);
      settings.invert = $<HTMLInputElement>("invert").checked;
      settings.volume = Number($<HTMLInputElement>("volume").value);
      saveSettings();
    };
  for (const action of Object.keys(keyDefaults) as (keyof Keys)[]) {
    const label = document.createElement("label");
    label.textContent = action;
    const control = document.createElement("input");
    control.value = settings.keys[action];
    control.readOnly = true;
    control.setAttribute("aria-label", `Rebind ${action}`);
    control.onkeydown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === "Escape") return;
      settings.keys[action] = e.code;
      control.value = e.code;
      saveSettings();
    };
    label.append(control);
    $("bindings").append(label);
  }
}
