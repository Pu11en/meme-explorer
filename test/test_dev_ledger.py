#!/usr/bin/env python3
"""
Tests for the dev-reputation ledger and money proxy. Run by the self-improve
gate before any autonomous change is accepted.

  /usr/bin/python3 test/test_dev_ledger.py
Exit 0 = all pass, nonzero = failure.
"""
import sys
import tempfile
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "scripts"))
import dev_ledger as dl  # noqa: E402


def _fresh_tmp():
    t = pathlib.Path(tempfile.mkdtemp())
    dl.LEDGER_PATH = t / "l.json"
    dl.OUT_PATH = t / "o.json"
    dl.LOCK_PATH = t / ".lk"
    return t


def test_wilson_lower_bound():
    # small samples are penalized; large confident samples are not
    assert dl.wilson_lower_bound(2, 2) < 0.6
    assert dl.wilson_lower_bound(40, 50) > 0.6
    assert dl.wilson_lower_bound(0, 0) == 0.0


def test_idempotency_and_organic_only():
    _fresh_tmp()
    coins = [
        {"creator": "W", "migrated": True, "verdict": "organic", "max_gain_pct": 120.0, "hold_gain_pct": 40.0},
        {"creator": "W", "migrated": True, "verdict": "organic", "max_gain_pct": 10.0, "hold_gain_pct": -30.0},
        {"creator": "W", "migrated": True, "verdict": "organic", "max_gain_pct": 300.0, "hold_gain_pct": -80.0},
        {"creator": "BUNDLER", "migrated": True, "verdict": "bundle", "max_gain_pct": 5.0, "hold_gain_pct": 1.0},
        {"creator": None, "migrated": True, "verdict": "organic", "max_gain_pct": 9.0, "hold_gain_pct": 9.0},
    ]
    dl.update_ledger("b1", coins)
    dl.update_ledger("b1", coins)  # idempotent — must not double count
    import json
    led = json.load(open(dl.LEDGER_PATH))
    assert led["devs"]["W"]["organic_migrations"] == 3
    assert led["devs"]["BUNDLER"]["organic_migrations"] == 0
    assert led["processed_batches"] == ["b1"]


def test_bundler_excluded_from_watchlist():
    _fresh_tmp()
    coins = [{"creator": "BUNDLER", "migrated": True, "verdict": "bundle",
              "max_gain_pct": 5.0, "hold_gain_pct": 1.0} for _ in range(5)]
    dl.update_ledger("b1", coins)
    out = dl.rank()
    assert not any(w["wallet"] == "BUNDLER" for w in out["wallets"]), "pure bundler must never publish"


def test_realistic_return_can_be_negative():
    _fresh_tmp()
    coins = [
        {"creator": "W", "migrated": True, "verdict": "organic", "max_gain_pct": 120.0, "hold_gain_pct": 40.0},
        {"creator": "W", "migrated": True, "verdict": "organic", "max_gain_pct": 10.0, "hold_gain_pct": -30.0},
        {"creator": "W", "migrated": True, "verdict": "organic", "max_gain_pct": 300.0, "hold_gain_pct": -80.0},
        {"creator": "W", "migrated": False, "verdict": "bundle", "max_gain_pct": 5.0, "hold_gain_pct": -60.0},
    ]
    dl.update_ledger("b1", coins)
    w = [x for x in dl.rank()["wallets"] if x["wallet"] == "W"][0]
    assert w["realistic_avg_gain_pct"] == -32.5, w["realistic_avg_gain_pct"]
    assert w["realistic_win_rate_pct"] == 25.0, w["realistic_win_rate_pct"]
    # best case is a ceiling — never negative
    assert w["best_case_avg_gain_pct"] >= 0


def test_corruption_self_heal():
    _fresh_tmp()
    dl.update_ledger("b1", [{"creator": "W", "migrated": True, "verdict": "organic",
                             "max_gain_pct": 60.0, "hold_gain_pct": 60.0}])
    open(dl.LEDGER_PATH, "w").write("{ this is broken json")
    healed = dl.load_ledger()
    assert healed["devs"] == {}, "corrupt ledger must self-heal to empty"
    assert not dl.LEDGER_PATH.with_suffix(".tmp").exists()


def test_prune_drops_stale_never_migrated():
    from datetime import datetime, timezone, timedelta
    _fresh_tmp()
    old = (datetime.now(timezone.utc) - timedelta(days=45)).isoformat()
    led = dl._empty_ledger()
    led["devs"]["DEAD"] = {"launches": 1, "migrations": 0, "organic_migrations": 0,
                           "first_seen": old, "last_seen": old, "last_migration": None,
                           "gain_samples": 0, "gain_sum_pct": 0.0, "profit_hits": 0}
    led["devs"]["KEEP"] = {"launches": 1, "migrations": 1, "organic_migrations": 1,
                           "first_seen": old, "last_seen": old, "last_migration": old,
                           "gain_samples": 0, "gain_sum_pct": 0.0, "profit_hits": 0}
    dl._prune(led)
    assert "DEAD" not in led["devs"], "stale never-migrated dev should be pruned"
    assert "KEEP" in led["devs"], "migrated dev within retention should stay"


def run():
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    failed = 0
    for t in tests:
        try:
            t()
            print(f"  PASS {t.__name__}")
        except Exception as e:
            failed += 1
            print(f"  FAIL {t.__name__}: {e}")
    print(f"{len(tests)-failed}/{len(tests)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(run())
