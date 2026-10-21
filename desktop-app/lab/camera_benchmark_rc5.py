"""RC5 - offline Windows DirectShow camera throughput benchmark.

Runs WITHOUT OBS MASTER, Unity Camera, or StreamYard (to avoid sharing the
device). Uses the validated Direct Lab Python environment. Does not edit
camera properties other than temporary negotiated resolution/FourCC/FPS.
"""
import argparse
import statistics
import time
import cv2


def codec_label(raw):
    try:
        raw = int(raw)
        letters = "".join(chr((raw >> (8 * i)) & 255) for i in range(4))
        if all(32 <= ord(char) < 127 for char in letters):
            return letters
        return f"unknown (0x{raw & 0xffffffff:08X})"
    except (TypeError, ValueError, OverflowError):
        return "unknown"


def percentile(samples, fraction):
    if not samples:
        return 0.0
    values = sorted(samples)
    return values[min(len(values) - 1, int((len(values) - 1) * fraction))]


def bench_mode(name, device, codec, width, height, target_fps, duration, warmup):
    cap = cv2.VideoCapture(device, cv2.CAP_DSHOW)
    if not cap.isOpened():
        print(f"{name}: ERROR: DirectShow cannot open camera {device}", flush=True)
        return None
    try:
        if codec:
            attempted = cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*codec))
            print(f"{name}: request FourCC={codec}, accepted-set={attempted}", flush=True)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
        cap.set(cv2.CAP_PROP_FPS, target_fps)
        negotiated = (int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
                      int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)))
        advertised = cap.get(cv2.CAP_PROP_FPS)
        fourcc = codec_label(cap.get(cv2.CAP_PROP_FOURCC))
        print(f"{name}: negotiated {negotiated[0]}x{negotiated[1]} @ {advertised:.1f} fps; FourCC={fourcc}", flush=True)

        # Autofocus / autoexposure and camera buffer may need to settle.
        end_warmup = time.perf_counter() + warmup
        while time.perf_counter() < end_warmup:
            ok, frame = cap.read()
            if not ok or frame is None:
                print(f"{name}: ERROR: no webcam frame during warmup", flush=True)
                return None

        read_ms = []
        convert_ms = []
        total = 0
        errors = 0
        start = time.perf_counter()
        until = start + duration
        while time.perf_counter() < until:
            t0 = time.perf_counter()
            ok, frame = cap.read()
            t1 = time.perf_counter()
            if not ok or frame is None:
                errors += 1
                continue
            _rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            t2 = time.perf_counter()
            read_ms.append((t1 - t0) * 1000)
            convert_ms.append((t2 - t1) * 1000)
            total += 1

        elapsed = time.perf_counter() - start
        measured = total / elapsed if elapsed else 0.0
        if not read_ms:
            print(f"{name}: ERROR: no valid frames captured", flush=True)
            return None
        result = {
            "mode": name,
            "fps": measured,
            "read_mean_ms": statistics.mean(read_ms),
            "read_median_ms": statistics.median(read_ms),
            "read_p95_ms": percentile(read_ms, 0.95),
            "convert_mean_ms": statistics.mean(convert_ms),
            "errors": errors,
            "fourcc": fourcc,
            "resolution": negotiated,
        }
        print(
            f"{name}: REAL {measured:.1f} FPS | read={result['read_mean_ms']:.1f}ms"
            f" (p50={result['read_median_ms']:.1f}, p95={result['read_p95_ms']:.1f})"
            f" | BGR->RGB={result['convert_mean_ms']:.1f}ms | bad frames={errors}",
            flush=True,
        )
        return result
    finally:
        cap.release()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--camera", type=int, default=0)
    parser.add_argument("--seconds", type=float, default=8.0)
    parser.add_argument("--warmup", type=float, default=2.0)
    args = parser.parse_args()
    print("OBS MASTER RC5 - MEASURE REAL PHYSICAL CAMERA THROUGHPUT", flush=True)
    print("Do NOT run while Unity Camera or another app is using the webcam.", flush=True)
    cases = [
        ("default-720p", None, 1280, 720),
        ("MJPG-720p", "MJPG", 1280, 720),
        ("YUY2-720p", "YUY2", 1280, 720),
        ("default-480p", None, 640, 480),
    ]
    results = []
    for name, codec, width, height in cases:
        print("", flush=True)
        try:
            result = bench_mode(
                name, args.camera, codec, width, height, 30,
                max(3.0, args.seconds), max(0.5, args.warmup),
            )
            if result is not None:
                results.append(result)
        except (cv2.error, OSError, RuntimeError) as error:
            print(f"{name}: ERROR {error}", flush=True)
    print("\n==== COMPARATIVE RESULTS (measured, not negotiated) ====", flush=True)
    for result in results:
        print(
            f"{result['mode']:15s} | {result['fps']:5.1f} FPS | "
            f"read {result['read_mean_ms']:6.1f}ms | "
            f"FourCC {result['fourcc']}",
            flush=True,
        )
    if not results:
        raise SystemExit("No usable camera mode. Check device ownership/driver.")


if __name__ == "__main__":
    main()
