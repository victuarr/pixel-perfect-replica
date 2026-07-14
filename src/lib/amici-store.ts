// Tiny global store to open/close the Amici sheet from anywhere.
type Listener = () => void;
let opened = false;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
}

export const amiciStore = {
  subscribe(l: Listener) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  getSnapshot() {
    return opened;
  },
  open() {
    if (!opened) {
      opened = true;
      emit();
    }
  },
  close() {
    if (opened) {
      opened = false;
      emit();
    }
  },
  set(v: boolean) {
    if (opened !== v) {
      opened = v;
      emit();
    }
  },
};
