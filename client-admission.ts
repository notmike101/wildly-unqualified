/** Join form and host slot reassignment; live state is read again after asynchronous requests. */
import type { Snapshot } from "./shared.ts";
import { api } from "./client-api.ts";
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
export async function renderReassign(
  getState: () => { isHost: boolean; latest: Snapshot | undefined },
  notify: (message: string) => void,
) {
  if (!getState().isHost || !getState().latest) return;
  try {
    const info = await api("/api/invite");
    const waiting: { id: string; name: string }[] = info.pending ?? [];
    $("reassign").hidden = waiting.length === 0;
    $("reassign-list").replaceChildren();
    for (const p of waiting) {
      const row = document.createElement("p");
      row.textContent = p.name + " → ";
      const select = document.createElement("select");
      for (const slot of getState().latest!.players.filter(
        (p) => !p.connected,
      )) {
        const option = document.createElement("option");
        option.value = slot.id;
        option.textContent = slot.name;
        select.append(option);
      }
      row.append(select);
      const b = document.createElement("button");
      b.textContent = "Restore slot";
      b.onclick = () =>
        void api("/api/reassign", {
          slotId: select.value,
          admittedPlayerId: p.id,
        })
          .then(() => renderReassign(getState, notify))
          .catch((e) => notify(String(e)));
      row.append(b);
      $("reassign-list").append(row);
    }
  } catch (e) {
    notify(String(e));
  }
}
export function installJoinForm(
  acceptSession: (session: {
    playerId: string;
    host: boolean;
    pending?: boolean;
  }) => Promise<void>,
) {
  $<HTMLFormElement>("join-form").onsubmit = async (e) => {
    e.preventDefault();
    const button = $("join-form").querySelector("button")!;
    button.disabled = true;
    $("join-status").textContent = "Joining the field crew…";
    try {
      let secret = $<HTMLInputElement>("secret").value.trim();
      try {
        if (secret.includes("://"))
          secret =
            new URLSearchParams(new URL(secret).hash.slice(1)).get("key") ??
            secret;
      } catch {}
      await acceptSession(
        await api("/api/join", {
          name: $<HTMLInputElement>("name").value.trim(),
          secret,
        }),
      );
      $<HTMLInputElement>("secret").value = "";
    } catch (error) {
      $("join-status").textContent = String(error);
    } finally {
      button.disabled = false;
    }
  };
}
