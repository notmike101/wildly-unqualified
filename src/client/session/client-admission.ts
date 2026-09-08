/**
Join form and host slot reassignment; live state is read again after asynchronous requests.
 */
import type { Snapshot } from '../../shared/shared.ts';
import { api } from './client-api.ts';

/**
 * Look up a required page element using the caller's expected element type. The page markup
 * must supply this ID.
 *
 * @template T - Expected DOM element subtype; the markup must satisfy this assertion.
 * @param id - Required element ID
 * @returns The existing DOM element; no runtime null or type check is performed.
 */
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.querySelector<T>(`#${CSS.escape(id)}`)!;

/**
 * Refresh the host's pending-admission controls and wire slot restoration. Reads current
 * state after requests and reports failures through the notification callback.
 *
 * @param getState - Getter for current host status and snapshot
 * @param notify - User-facing failure notification callback
 */
export async function renderReassign(
    getState: () => { isHost: boolean; latest: Snapshot | undefined },
    notify: (message: string) => void,
) {
    if (!getState().isHost || !getState().latest) return;
    try {
        const info = await api('/api/invite');
        const waiting: { id: string; name: string }[] = info.pending ?? [];

        $('reassign').hidden = waiting.length === 0;
        $('reassign-list').replaceChildren();
        for (const p of waiting) {
            const row = document.createElement('p');

            row.textContent = p.name + ' → ';
            const select = document.createElement('select');

            const availableSlots = getState().latest!.players.filter((player) => !player.connected);

            for (const slot of availableSlots) {
                const option = document.createElement('option');

                option.value = slot.id;
                option.textContent = slot.name;
                select.append(option);
            }
            row.append(select);
            const b = document.createElement('button');

            b.textContent = 'Restore slot';

            /**
             * Request restoration of the selected crew slot, then refresh host controls.
             *
             * @returns No value; the request handles failures through notify.
             */
            b.addEventListener('click', () => void api('/api/reassign', {
                slotId: select.value,
                admittedPlayerId: p.id,
            })
                .then(() => renderReassign(getState, notify))
                .catch((error) => notify(String(error))));
            row.append(b);
            $('reassign-list').append(row);
        }
    } catch (error) {
        notify(String(error));
    }
}

/**
 * Install the join form handler, accepting a key or invite URL. Disables submission during
 * admission, clears the secret on success, and shows failures inline.
 *
 * @param acceptSession - Callback that installs an admitted session
 */
export function installJoinForm(
    acceptSession: (session: {
        playerId: string;
        host: boolean;
        pending?: boolean;
    }) => Promise<void>,
) {
    /**
     * Submit an invitation through admission and display the outcome in the form.
     *
     * @param event - Form submission event; its default navigation is prevented
     */
    $<HTMLFormElement>('join-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = $('join-form').querySelector('button')!;

        button.disabled = true;
        $('join-status').textContent = 'Joining the field crew…';
        try {
            let secret = $<HTMLInputElement>('secret').value.trim();

            try {
                if (secret.includes('://'))
                    secret
                        = new URLSearchParams(new URL(secret).hash.slice(1)).get('key')
                            ?? secret;
            } catch {
                // Malformed invite URLs are still submitted as literal keys.

            }
            await acceptSession(
                await api('/api/join', {
                    name: $<HTMLInputElement>('name').value.trim(),
                    secret,
                }),
            );
            $<HTMLInputElement>('secret').value = '';
        } catch (error) {
            $('join-status').textContent = String(error);
        } finally {
            button.disabled = false;
        }
    });
}
