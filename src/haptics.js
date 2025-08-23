// [C4-STEP-6] XR Haptics (Gamepad hapticActuators) mit Fallback

let enabled = true;
export function setHapticsEnabled(on){ enabled = !!on; }

export function pulseXR(session, intensity=0.5, duration=20) {
  if (!enabled || !session) return;
  try {
    for (const src of session.inputSources) {
      const gp = src.gamepad;
      if (!gp || !gp.hapticActuators) continue;
      for (const act of gp.hapticActuators) {
        if (typeof act.pulse === 'function') {
          act.pulse(Math.max(0, Math.min(1, intensity)), duration);
        }
      }
    }
  } catch {}
}

export function buzzSelect(session){ pulseXR(session, 0.6, 22); }
export function buzzLanded(session){ pulseXR(session, 0.4, 18); }
export function buzzWin(session)   { pulseXR(session, 0.9, 40); }
export function buzzInvalid(session){ pulseXR(session, 0.5, 20); }
