import { WEAK_PINS } from './types';

export function generateTemporaryPin(): string {
  while (true) {
    const pin = Math.floor(100000 + Math.random() * 900000).toString();

    if (!WEAK_PINS.includes(pin)) {
      return pin;
    }
  }
}