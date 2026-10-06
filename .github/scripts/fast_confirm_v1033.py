from pathlib import Path

SERVICE = Path(".github/native-overlay/ScalpOverlayService.kt")
s = SERVICE.read_text(encoding="utf-8")

if "private const val CONFIRMATION_SPACING_MS = 20000L" not in s:
    raise SystemExit("confirmation spacing marker not found")
s = s.replace(
    "private const val CONFIRMATION_SPACING_MS = 20000L",
    "private const val CONFIRMATION_SPACING_MS = 5000L",
    1
)

if "now - candidateLastAt <= 65000L" not in s:
    raise SystemExit("candidate freshness marker not found")
s = s.replace(
    "now - candidateLastAt <= 65000L",
    "now - candidateLastAt <= 18000L",
    1
)

# Make the waiting text explicit so the user knows the signal is actively progressing.
s = s.replace(
    '"Candidat " + rawSignal + " • Confirmare " + candidateCount + "/" + REQUIRED_CONFIRMATIONS,',
    '"Candidat " + rawSignal + " • Confirmare " + candidateCount + "/" + REQUIRED_CONFIRMATIONS + " • ~5 sec",',
    1
)

SERVICE.write_text(s, encoding="utf-8")
print("v1.0.33 fast 3/3 confirmation applied")
