# Phone as a cricket bat: how to handle the gyro sensors

Notes for Cricket Nets, where a phone held like a bat handle moves the bat. Code involved:

- `frontend/controllers/cricket.html`: the phone page. It reads `deviceorientation` and sends the phone's turn since
  centring (`q`) about 60 times a second.
- `frontend/src/games/engines/cricket/nets/batter.js`: turns that into the bat's pose (`stepBatter`, `input.q`).

## The problem: the bat hangs in the air at an angle

1. **A slightly tilted phone at Start or Recenter tilts the bat permanently.** The phone sends only `q0⁻¹ · q`, the
   turn since calibration, and `batter.js` applies it on top of a fixed upright stance (`STANCE_Q`). The bat never
   learns which way is actually down. Calibration also happens automatically on the first sensor reading, so any
   tilt at that moment carries through.
2. **The hands are fixed in mid-air.** A phone knows how it is turned, not where it is. So the bat hangs from a fixed
   top-hand point (`HANDS`, about 0.93 m up), swung on an "arm" about a shoulder point. There is no batter's body,
   so any tilt reads as a floating bat with its toe off the ground.
3. **Turns can come out on the wrong axis.** The turn is in the phone's own axes at calibration and is used directly as
   the bat's axes (x across the face, y up the handle, z out of the back). That only holds if the phone was held
   exactly like a handle at calibration: upright, screen towards you. If not, tipping the phone forward can come out
   on the bat as a twist or a lean.

## How phone-as-motion-controller is normally done

- **Keep "down" separate from "facing".** Which way is down (tilt) comes from gravity and is reliable, so use it
  directly. Only the compass direction (heading) should come from Recenter. An upright phone then always gives a bat
  with its toe down, whenever Recenter was pressed.
- **Apply the turn in world axes, not phone axes.** Use the phone's real-world rotation, lined up with the pitch at
  calibration, as the bat's rotation. The bat then copies what the hand does, whatever the grip on the phone.
- **Use the gyroscope for the swing itself.** `deviceorientation` is smoothed, and in some browsers its rate rises and
  falls with how fast the phone turns. The raw gyro rate (`devicemotion.rotationRate`, in degrees per second) is the
  fast signal. The usual pattern is a complementary filter: the gyro tracks quick motion and gravity corrects slow
  drift. Quaternions avoid gimbal lock.
- **Prefer `RelativeOrientationSensor` where it exists.** The W3C Orientation Sensor API gives a quaternion from named
  sensors (accelerometer and gyroscope, no magnetometer) and is designed for lower latency. Chrome for Android has it.
  iPhone Safari does not, so keep `deviceorientation` as the fallback. Check the quaternion's component order against
  the current spec.
- **Expect the gyro to max out at the top of a hard swing,** around impact. Bat-sensor studies report this saturation.
  Cap or extrapolate the bat's speed there instead of trusting the raw reading.
- **Allow for lag.** Phone sensors often add 50–100 ms on Android, plus the Wi-Fi hop. Send timestamps and the gyro
  rate, and have the game extrapolate the bat a frame or two ahead.
- **Give the bat a body.** A phone gives no position, so games script where the hands are from the swing phase: low,
  with the toe grounded, at the stance; up and back on the backlift; through and high on the follow-through.

## Planned changes, in order

1. **Stance from gravity.** Take the stance's tilt from gravity and calibrate only the heading. This is the main fix for
   the floating, crooked bat. (`cricket.html`, `batter.js`)
2. **World-axis turns.** Apply the phone's turn to the bat in world axes, aligned to the pitch at calibration.
   (`cricket.html`, `batter.js`)
3. **Gyro rate and timestamps.** Send both, extrapolate the bat in the game, and use the rate for bat speed at contact.
4. **`RelativeOrientationSensor`.** Use it where available, keeping `deviceorientation` as the fallback.
5. **A grounded stance.** Plant the toe at the stance and script the hand path from the swing angle.

Steps 1 and 2 are a contained change to the two files above and fix what is visible now.

## Sources

- [Boris Smus: Sensor fusion and motion prediction for WebVR](https://smus.com/sensor-fusion-prediction-webvr)
- [W3C Orientation Sensor spec](https://www.w3.org/TR/2023/WD-orientation-sensor-20230801/)
- [Chrome: Sensors for the web](https://developer.chrome.com/articles/generic-sensor/)
- [web.dev: Device Orientation & Motion](https://web.dev/device-orientation)
- [W3C Generic Sensor explainer](https://lists.w3.org/Archives/Public/public-device-apis/2017Mar/att-0008/explainer.html)
- [Swing analysis patent (gyro saturation into impact)](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/10046220)
- [Bat-sensor validation study (MDPI Sensors)](https://mdpi.com/1424-8220/24/22/7106)
