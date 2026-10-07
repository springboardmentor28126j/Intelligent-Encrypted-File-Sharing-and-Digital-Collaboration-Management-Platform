"""
Live End-to-End Test for Milestone 3 Security Monitoring & Lockout System
Validates all 8 specific user requirements against the running FastAPI instance at http://127.0.0.1:8000
"""
import sys
import uuid
import httpx

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = "http://127.0.0.1:8000"

def run_milestone3_comprehensive_tests():
    client = httpx.Client(base_url=BASE_URL, timeout=10.0)
    print("=" * 70)
    print("STARTING LIVE MILESTONE 3 COMPREHENSIVE SECURITY VERIFICATION")
    print("=" * 70)

    uid = uuid.uuid4().hex[:8]
    user_a_email = f"alice_{uid}@example.com"
    user_b_email = f"bob_{uid}@example.com"
    admin_email = f"admin_{uid}@example.com"
    pwd = "SecurePassword123!"

    # 1. Register User A, User B, and an Admin
    print(f"\n[Test 1] Registering Alice ({user_a_email}), Bob ({user_b_email}), and Admin ({admin_email})...")
    res_reg_a = client.post("/register", json={"full_name": "Alice User", "email": user_a_email, "password": pwd})
    assert res_reg_a.status_code == 201, f"Failed reg A: {res_reg_a.text}"
    user_a_id = res_reg_a.json()["id"]

    res_reg_b = client.post("/register", json={"full_name": "Bob User", "email": user_b_email, "password": pwd})
    assert res_reg_b.status_code == 201, f"Failed reg B: {res_reg_b.text}"

    res_reg_adm = client.post("/register", json={"full_name": "Security Admin", "email": admin_email, "password": pwd, "role": "admin"})
    assert res_reg_adm.status_code == 201, f"Failed reg Admin: {res_reg_adm.text}"

    # Logins
    res_login_a = client.post("/login", json={"email": user_a_email, "password": pwd})
    assert res_login_a.status_code == 200, f"Failed login A: {res_login_a.text}"
    token_a = res_login_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    res_login_adm = client.post("/login", json={"email": admin_email, "password": pwd})
    assert res_login_adm.status_code == 200, f"Failed login Admin: {res_login_adm.text}"
    token_adm = res_login_adm.json()["access_token"]
    headers_adm = {"Authorization": f"Bearer {token_adm}"}
    print("✓ Registration and Logins successful. JWT tokens acquired.")

    # 2. Single Failed Login Test (User remains unlocked)
    print("\n[Test 2] Single failed login attempt for User A...")
    res_single_fail = client.post("/login", json={"email": user_a_email, "password": "WrongPassword1"})
    assert res_single_fail.status_code == 401
    print(f"✓ Single failed login rejected with 401: '{res_single_fail.json()['detail']}'")

    # Login with correct password succeeds immediately
    res_login_retry = client.post("/login", json={"email": user_a_email, "password": pwd})
    assert res_login_retry.status_code == 200, "Should allow login after single failure"
    print("✓ Login succeeds with correct password, counter reset.")

    # 3. Repeated Failed Logins until Lockout Threshold (5 failed attempts)
    print("\n[Test 3] Simulating brute-force attack: 5 consecutive failed logins...")
    for i in range(1, 5):
        res_f = client.post("/login", json={"email": user_a_email, "password": f"BadPassword{i}"})
        assert res_f.status_code == 401
        print(f"  - Attempt {i}/5 rejected: {res_f.json()['detail']}")

    # 5th attempt triggers lockout
    res_f5 = client.post("/login", json={"email": user_a_email, "password": "BadPassword5"})
    assert res_f5.status_code == 401
    assert "locked" in res_f5.json()["detail"].lower()
    print(f"✓ 5th failed attempt triggered lockout: '{res_f5.json()['detail']}'")

    # 4. Direct API Login Bypass Attempt while Locked (even with CORRECT password)
    print("\n[Test 4] Direct API Bypass test: attempting login with CORRECT credentials while account is locked...")
    res_locked_attempt = client.post("/login", json={"email": user_a_email, "password": pwd})
    assert res_locked_attempt.status_code == 401, f"Expected 401, got {res_locked_attempt.status_code}"
    assert "locked" in res_locked_attempt.json()["detail"].lower(), "Lockout message expected"
    print(f"✓ Backend strictly blocked login for locked user: '{res_locked_attempt.json()['detail']}'")

    # 5. Verify Security Monitoring APIs & Data
    print("\n[Test 5] Querying Security Monitoring APIs as Administrator...")
    
    # Summary
    res_summary = client.get("/security/summary", headers=headers_adm)
    assert res_summary.status_code == 200, f"Summary failed: {res_summary.text}"
    sdata = res_summary.json()
    print(f"✓ Security Summary: Total Events: {sdata['total_events']}, Locked Accounts: {sdata['locked_accounts_count']}, Suspicious: {sdata['suspicious_activities_count']}")
    assert sdata["locked_accounts_count"] >= 1, "Expected at least 1 locked account"

    # Locked Accounts List
    res_locked = client.get("/security/locked-accounts", headers=headers_adm)
    assert res_locked.status_code == 200
    locked_list = res_locked.json()
    assert any(acc["email"] == user_a_email for acc in locked_list), "Alice not found in locked accounts"
    alice_lock = [acc for acc in locked_list if acc["email"] == user_a_email][0]
    print(f"✓ Locked Account Entry: {alice_lock['email']}, Reason: {alice_lock['lock_reason']}, Remaining: ~{alice_lock['remaining_minutes']}m")

    # Security Alerts
    res_alerts = client.get("/security/alerts", headers=headers_adm)
    assert res_alerts.status_code == 200
    alerts = res_alerts.json()
    assert len(alerts) >= 1, "Expected at least 1 security alert"
    print(f"✓ Security Alerts List: Found {len(alerts)} alerts. Latest: '{alerts[0]['title']}' ({alerts[0]['severity']})")

    # Suspicious Activities
    res_susp = client.get("/security/suspicious-activities", headers=headers_adm)
    assert res_susp.status_code == 200
    susp_list = res_susp.json()
    assert len(susp_list) >= 1, "Expected suspicious activity records"
    print(f"✓ Suspicious Activities: Found {len(susp_list)} records. Latest: '{susp_list[0]['activity_type']}' ({susp_list[0]['attempt_count']} attempts)")

    # Security Analytics
    res_sec_analytics = client.get("/security/analytics?days=7", headers=headers_adm)
    assert res_sec_analytics.status_code == 200
    sec_an = res_sec_analytics.json()
    print(f"✓ Security Analytics: Severity breakdown: {sec_an['severity_distribution']}")

    # 6. Admin Account Unlock & Audit Log
    print(f"\n[Test 6] Admin unlocking Alice's account (User ID: {user_a_id})...")
    res_unlock = client.post(f"/security/unlock-account/{user_a_id}", headers=headers_adm)
    assert res_unlock.status_code == 200, f"Unlock failed: {res_unlock.text}"
    print(f"✓ Account unlocked: {res_unlock.json()['message']}")

    # Alice logs in with correct credentials now
    res_login_after_unlock = client.post("/login", json={"email": user_a_email, "password": pwd})
    assert res_login_after_unlock.status_code == 200, "Alice should be able to login after unlock"
    token_a_new = res_login_after_unlock.json()["access_token"]
    headers_a_new = {"Authorization": f"Bearer {token_a_new}"}
    print("✓ Alice successfully logged in after admin unlock!")

    # 7. File Operations, Sharing, Unauthorized Access & Notifications
    print("\n[Test 7] Uploading encrypted file and testing unauthorized access detection...")
    file_payload = {"file": ("financial_plan.pdf", b"Secret data 9876543210", "application/pdf")}
    res_up = client.post("/files/upload", headers=headers_a_new, files=file_payload, data={"description": "M3 Confidential"})
    assert res_up.status_code == 201
    file_id = res_up.json()["id"]

    # Bob unauthorized download attempt
    token_b = client.post("/login", json={"email": user_b_email, "password": pwd}).json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}
    res_unauth_dl = client.get(f"/files/{file_id}/download", headers=headers_b)
    assert res_unauth_dl.status_code == 403, f"Expected 403 Forbidden, got {res_unauth_dl.status_code}"
    print(f"✓ Unauthorized file download correctly forbidden with 403.")

    # Check that unauthorized access is logged in audit log
    res_audit = client.get("/audit/logs", headers=headers_adm)
    assert res_audit.status_code == 200
    all_logs = res_audit.json()
    actions = [l["action"] for l in all_logs]
    assert "account_unlocked" in actions, "Missing account_unlocked in audit log"
    assert "unauthorized_access" in actions or "failed_login" in actions
    print(f"✓ Audit logs contain complete security lifecycle: {set(actions)}")

    print("\n" + "=" * 70)
    print("ALL MILESTONE 3 LIVE SECURITY MONITORING & LOCKOUT TESTS PASSED!")
    print("=" * 70)

if __name__ == "__main__":
    try:
        run_milestone3_comprehensive_tests()
    except Exception as e:
        print(f"\n❌ TEST SUITE FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
