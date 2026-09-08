/**
 * Look up a required page element using the caller's expected element type. The page markup
 * must supply this ID.
 *
 * @template T - Expected DOM element subtype; the markup must satisfy this assertion.
 * @param id - Required element ID
 * @returns The existing DOM element; no runtime null or type check is performed.
 */
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.querySelector<T>(`#${CSS.escape(id)}`)!;
const keyDefaults = {
    forward: 'KeyW',
    back: 'KeyS',
    left: 'KeyA',
    right: 'KeyD',
    run: 'ShiftLeft',
    crouch: 'KeyC',
    interact: 'KeyE',
    use: 'KeyQ',
    drop: 'KeyG',
    ping: 'KeyF',
    notebook: 'Tab',
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
    const stored = JSON.parse(localStorage.getItem('wu-settings') ?? 'null');

    if (stored) {
        settings.sensitivity = Math.max(
            0.3,
            Math.min(3, Number(stored.sensitivity) || 1),
        );
        settings.invert = !!stored.invert;
        settings.volume = Math.max(0, Math.min(1, Number(stored.volume) || 0));
        for (const key of Object.keys(keyDefaults) as (keyof Keys)[])
            if (typeof stored.keys?.[key] === 'string')
                settings.keys[key] = stored.keys[key];
    }
} catch {
    /*
    Corrupt local preferences never block admission.
    */
}

/**
 * Persist the current local preferences as JSON in browser storage.
 *
 * @throws {DOMException} Browser storage is unavailable or its quota is exceeded.
 */
function saveSettings() {
    localStorage.setItem('wu-settings', JSON.stringify(settings));
}

/**
 * Populate preference controls and install change/key-binding handlers. Call once during
 * startup; handlers update the shared settings object and persist changes.
 */
export function setupSettings() {
    $<HTMLInputElement>('sensitivity').value = String(settings.sensitivity);
    $<HTMLInputElement>('invert').checked = settings.invert;
    $<HTMLInputElement>('volume').value = String(settings.volume);
    for (const id of ['sensitivity', 'invert', 'volume'])

    /**
    Read the preference controls into shared settings and persist them locally.
     */
        $(id).addEventListener('change', () => {
            settings.sensitivity = Number($<HTMLInputElement>('sensitivity').value);
            settings.invert = $<HTMLInputElement>('invert').checked;
            settings.volume = Number($<HTMLInputElement>('volume').value);
            saveSettings();
        });
    for (const action of Object.keys(keyDefaults) as (keyof Keys)[]) {
        const label = document.createElement('label');

        label.textContent = action;
        const control = document.createElement('input');

        control.value = settings.keys[action];
        control.readOnly = true;
        control.setAttribute('aria-label', `Rebind ${action}`);

        /**
         * Capture a replacement key binding while preventing gameplay input and navigation.
         * Escape leaves the existing binding unchanged.
         *
         * @param event - Keyboard event received by the binding control
         */
        control.addEventListener('keydown', (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (event.code === 'Escape') return;
            settings.keys[action] = event.code;
            control.value = event.code;
            saveSettings();
        });
        label.append(control);
        $('bindings').append(label);
    }
}
