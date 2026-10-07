$ErrorActionPreference = "Stop"
$base = "http://127.0.0.1:8000"
$pass = 0; $fail = 0
function Check($name, $cond, $extra="") {
  if ($cond) { Write-Host "  PASS  $name"; $script:pass++ }
  else { Write-Host "  FAIL  $name  $extra" -ForegroundColor Red; $script:fail++ }
}

# Registration behaves differently depending on whether email confirmation is
# switched on, so ask the backend which mode it is in rather than assuming.
$health = Invoke-RestMethod "$base/api/health"
$confirmEmail = [bool]$health.email_confirmation
Write-Host "`nEmail confirmation: $(if ($confirmEmail) { 'ON (hard gate)' } else { 'OFF (registering signs in)' })"

Write-Host "`n== 1. UIU email rule =="
foreach ($bad in @("student@gmail.com","student@yahoo.com","student@outlook.com")) {
  try {
    Invoke-RestMethod "$base/api/auth/register" -Method Post -ContentType application/json `
      -Body (@{name="Test User";email=$bad;password="Password123"} | ConvertTo-Json) | Out-Null
    Check "reject $bad" $false "was accepted!"
  } catch { Check "reject $bad" ($_.Exception.Response.StatusCode.value__ -eq 422) }
}

Write-Host "`n== 2. Protected routes reject anonymous =="
foreach ($p in @("/api/items","/api/dashboard","/api/matches","/api/claims","/api/conversations","/api/notifications")) {
  try { Invoke-RestMethod "$base$p" | Out-Null; Check "401 on $p" $false "was public!" }
  catch { Check "401 on $p" ($_.Exception.Response.StatusCode.value__ -eq 401) }
}

Write-Host "`n== 3. Public stats are public but anonymous =="
$stats = Invoke-RestMethod "$base/api/stats"
Check "GET /api/stats works" ($null -ne $stats.active_reports)
Check "stats expose numbers only" (($stats | Get-Member -MemberType NoteProperty).Count -eq 3)

Write-Host "`n== 4. Register a new UIU member =="
$new = "demo$(Get-Random -Max 99999)@bscse.uiu.ac.bd"
$s1 = $null
$u = Invoke-RestMethod "$base/api/auth/register" -Method Post -ContentType application/json `
  -Body (@{name="Demo Student";email=$new;password="Password123";department="CSE"} | ConvertTo-Json) `
  -SessionVariable s1
Check "register accepts *.uiu.ac.bd" ($u.email -eq $new)
Check "password never returned" ($null -eq $u.password_hash)

if ($confirmEmail) {
  # The hard gate: creating the account issues no session, only a pending cookie.
  try {
    Invoke-RestMethod "$base/api/auth/me" -WebSession $s1 | Out-Null
    Check "register does NOT sign anybody in" $false "it returned a working session!"
  } catch { Check "register does NOT sign anybody in" ($_.Exception.Response.StatusCode.value__ -eq 401) }
  $waiting = Invoke-RestMethod "$base/api/auth/pending" -WebSession $s1
  Check "the pending cookie names the account" ($waiting.email -eq $new)
} else {
  # Confirmation off: registering is the sign-in, and the account is usable now.
  Check "register returns the signed-in member" ($u.user.email -eq $new)
  Check "no confirmation code is issued" ($null -eq $u.verification)
  $whoNew = Invoke-RestMethod "$base/api/auth/me" -WebSession $s1
  Check "register signs the member straight in" ($whoNew.email -eq $new)
  Check "the account is usable immediately" ($whoNew.is_verified -eq $true)
}

Write-Host "`n== 5. Sign in as seeded member (faculty demo step 1) =="
$s = $null
$me = Invoke-RestMethod "$base/api/auth/login" -Method Post -ContentType application/json `
  -Body (@{email="ayesha@bscse.uiu.ac.bd";password="UniFind2026"} | ConvertTo-Json) -SessionVariable s
Check "login returns the member" ($me.email -eq "ayesha@bscse.uiu.ac.bd")
$whoami = Invoke-RestMethod "$base/api/auth/me" -WebSession $s
Check "session cookie authenticates /me" ($whoami.id -eq $me.id)

Write-Host "`n== 6. Report a lost item (FEATURE 1, demo steps 2-4) =="
$body = @{
  type="lost"; title="Samsung Galaxy S24"; category="Electronics"
  description="Lost my black Samsung Galaxy S24 in the library near the reading desks."
  location="Main Library"; date_lost_found="2026-08-16T00:00:00Z"; color="Black"; brand="Samsung"
} | ConvertTo-Json
$created = Invoke-RestMethod "$base/api/items" -Method Post -ContentType application/json -Body $body -WebSession $s
Check "item saved to SQLite" ($created.item.id -gt 0)
Check "owner is the signed-in member" ($created.item.owner_id -eq $me.id)
Check "status starts OPEN" ($created.item.status -eq "open")
$itemId = $created.item.id

Write-Host "`n== 7. Browse / search / filter / sort (FEATURE 2, demo steps 5-8) =="
$all = Invoke-RestMethod "$base/api/items" -WebSession $s
Check "new item appears in Browse" ($all.id -contains $itemId)
$search = Invoke-RestMethod "$base/api/items?search=Samsung" -WebSession $s
Check "search 'Samsung' finds it" ($search.id -contains $itemId)
$filtered = Invoke-RestMethod "$base/api/items?category=Electronics&type=lost" -WebSession $s
Check "filter Electronics+lost finds it" ($filtered.id -contains $itemId)
$miss = Invoke-RestMethod "$base/api/items?search=zzzznotathing" -WebSession $s
Check "no-match search returns empty" ($miss.Count -eq 0)
$recent = Invoke-RestMethod "$base/api/items?sort=recent" -WebSession $s
$oldest = Invoke-RestMethod "$base/api/items?sort=oldest" -WebSession $s
Check "sort recent vs oldest differ" ($recent[0].id -ne $oldest[0].id)
$mine = Invoke-RestMethod "$base/api/items?mine=true" -WebSession $s
Check "mine=true returns only own posts" (($mine | Where-Object { $_.owner_id -ne $me.id }).Count -eq 0)

Write-Host "`n== 8. Smart Matching =="
$matches = Invoke-RestMethod "$base/api/matches" -WebSession $s
Check "matches surfaced for own items" ($matches.Count -gt 0)
$top = $matches | Sort-Object score -Descending | Select-Object -First 1
Check "score is a percentage under 100" ($top.score -gt 0 -and $top.score -lt 100)
Check "match carries reasons" ($top.reasons.Count -gt 0)
Check "lost is matched against found" ($top.own_item.type -ne $top.matched_item.type)
Write-Host "        top match: $($top.own_item.title) -> $($top.matched_item.title) = $($top.score)%"
Write-Host "        reasons:   $($top.reasons -join ' | ')"

Write-Host "`n== 9. Claim + status tracking (FEATURE 3) =="
$s2 = $null
Invoke-RestMethod "$base/api/auth/login" -Method Post -ContentType application/json `
  -Body (@{email="tanvir@eee.uiu.ac.bd";password="UniFind2026"} | ConvertTo-Json) -SessionVariable s2 | Out-Null
$claim = Invoke-RestMethod "$base/api/items/$itemId/claims" -Method Post -ContentType application/json `
  -Body (@{verification_message="It has a cracked corner and my UIU ID in the case."} | ConvertTo-Json) -WebSession $s2
Check "claim submitted" ($claim.status -eq "submitted")
$after = Invoke-RestMethod "$base/api/items/$itemId" -WebSession $s
Check "OPEN -> PENDING on claim" ($after.status -eq "pending")
try {
  Invoke-RestMethod "$base/api/items/$itemId/claims" -Method Post -ContentType application/json `
    -Body (@{verification_message="Trying to claim this a second time now."} | ConvertTo-Json) -WebSession $s2 | Out-Null
  Check "duplicate claim blocked" $false "second claim accepted!"
} catch { Check "duplicate claim blocked" ($_.Exception.Response.StatusCode.value__ -eq 409) }
try {
  Invoke-RestMethod "$base/api/items/$itemId/claims" -Method Post -ContentType application/json `
    -Body (@{verification_message="Claiming my own item should not work."} | ConvertTo-Json) -WebSession $s | Out-Null
  Check "cannot claim own item" $false "self-claim accepted!"
} catch { Check "cannot claim own item" ($_.Exception.Response.StatusCode.value__ -eq 400) }

Write-Host "`n== 10. Ownership rules =="
try {
  Invoke-RestMethod "$base/api/items/$itemId" -Method Put -ContentType application/json `
    -Body (@{title="Hijacked title"} | ConvertTo-Json) -WebSession $s2 | Out-Null
  Check "cannot edit another member's post" $false "edit allowed!"
} catch { Check "cannot edit another member's post" ($_.Exception.Response.StatusCode.value__ -eq 403) }
try {
  Invoke-RestMethod "$base/api/items/$itemId" -Method Delete -WebSession $s2 | Out-Null
  Check "cannot delete another member's post" $false "delete allowed!"
} catch { Check "cannot delete another member's post" ($_.Exception.Response.StatusCode.value__ -eq 403) }
try {
  Invoke-RestMethod "$base/api/admin/stats" -WebSession $s2 | Out-Null
  Check "non-admin blocked from /api/admin" $false "admin area open!"
} catch { Check "non-admin blocked from /api/admin" ($_.Exception.Response.StatusCode.value__ -eq 403) }

Write-Host "`n== 11. Private identifying details =="
$priv = @{
  type="found"; title="Wallet with private proof"; category="Wallets"
  description="Found a wallet in the cafeteria with contents I have not listed publicly."
  location="Cafeteria"; date_lost_found="2026-08-15T00:00:00Z"
  identifying_details="Contains a UIU ID for roll 011201234 and a torn bus pass."
} | ConvertTo-Json
$privItem = (Invoke-RestMethod "$base/api/items" -Method Post -ContentType application/json -Body $priv -WebSession $s).item
$asOwner = Invoke-RestMethod "$base/api/items/$($privItem.id)" -WebSession $s
$asOther = Invoke-RestMethod "$base/api/items/$($privItem.id)" -WebSession $s2
Check "owner sees identifying_details" ($null -ne $asOwner.identifying_details)
Check "other member does NOT" ($null -eq $asOther.identifying_details)

Write-Host "`n== 12. Comments + messaging + notifications =="
$c = Invoke-RestMethod "$base/api/items/$itemId/comments" -Method Post -ContentType application/json `
  -Body (@{body="I saw something similar near the library entrance."} | ConvertTo-Json) -WebSession $s2
Check "comment created" ($c.id -gt 0)
$conv = Invoke-RestMethod "$base/api/conversations" -Method Post -ContentType application/json `
  -Body (@{item_id=$itemId} | ConvertTo-Json) -WebSession $s2
Check "conversation opened" ($conv.id -gt 0)
Invoke-RestMethod "$base/api/conversations/$($conv.id)/messages" -Method Post -ContentType application/json `
  -Body (@{body="Does the phone have a blue case?"} | ConvertTo-Json) -WebSession $s2 | Out-Null
$thread = Invoke-RestMethod "$base/api/conversations/$($conv.id)" -WebSession $s
Check "message stored and readable by both" ($thread.messages.Count -ge 1)
$notes = Invoke-RestMethod "$base/api/notifications" -WebSession $s
Check "owner notified of claim/comment/message" ($notes.Count -ge 3)
Check "notifications carry a destination href" (($notes | Where-Object { $_.href }).Count -gt 0)

Write-Host "`n== 13. Conversation privacy =="
$s3 = $null
Invoke-RestMethod "$base/api/auth/login" -Method Post -ContentType application/json `
  -Body (@{email="nusrat@bba.uiu.ac.bd";password="UniFind2026"} | ConvertTo-Json) -SessionVariable s3 | Out-Null
try {
  Invoke-RestMethod "$base/api/conversations/$($conv.id)" -WebSession $s3 | Out-Null
  Check "outsider blocked from conversation" $false "conversation leaked!"
} catch { Check "outsider blocked from conversation" ($_.Exception.Response.StatusCode.value__ -eq 403) }

Write-Host "`n== 14. Approve claim -> RESOLVED + resolved gallery =="
Invoke-RestMethod "$base/api/claims/$($claim.id)" -Method Patch -ContentType application/json `
  -Body (@{status="approved"} | ConvertTo-Json) -WebSession $s | Out-Null
Invoke-RestMethod "$base/api/items/$itemId/status" -Method Patch -ContentType application/json `
  -Body (@{status="resolved"} | ConvertTo-Json) -WebSession $s | Out-Null
$resolved = Invoke-RestMethod "$base/api/items?status=resolved" -WebSession $s
Check "item appears in resolved gallery" ($resolved.id -contains $itemId)
$matchesAfter = Invoke-RestMethod "$base/api/matches" -WebSession $s
Check "resolved item drops out of matching" (($matchesAfter | Where-Object { $_.own_item.id -eq $itemId }).Count -eq 0)

Write-Host "`n== 14b. Claim and item state machine =="
# A decided claim is final. Without this the same claim could be flipped between
# approved and rejected, and two rival claimants could both hold an approval.
try {
  Invoke-RestMethod "$base/api/claims/$($claim.id)" -Method Patch -ContentType application/json `
    -Body (@{status="rejected"} | ConvertTo-Json) -WebSession $s | Out-Null
  Check "an approved claim cannot be flipped" $false "the decision was reversed!"
} catch { Check "an approved claim cannot be flipped" ($_.Exception.Response.StatusCode.value__ -eq 409) }

try {
  Invoke-RestMethod "$base/api/items/$itemId/status" -Method Patch -ContentType application/json `
    -Body (@{status="open"} | ConvertTo-Json) -WebSession $s | Out-Null
  Check "a resolved case cannot be reopened" $false "it was reopened!"
} catch { Check "a resolved case cannot be reopened" ($_.Exception.Response.StatusCode.value__ -eq 409) }
$stillResolved = Invoke-RestMethod "$base/api/items/$itemId" -WebSession $s
Check "resolved -> resolved stays idempotent" (
  (Invoke-RestMethod "$base/api/items/$itemId/status" -Method Patch -ContentType application/json `
    -Body (@{status="resolved"} | ConvertTo-Json) -WebSession $s).status -eq "resolved")

# Two rivals on one item: approving one must close the other, not leave it open.
$rival = Invoke-RestMethod "$base/api/items" -Method Post -ContentType application/json -WebSession $s `
  -Body (@{type="found";title="State machine rival umbrella";category="Other"
           description="Item used to check that approving one claim closes the others."
           location="Main Library";date_lost_found="2026-08-18T00:00:00Z"} | ConvertTo-Json)
$rivalId = $rival.item.id
$claimA = Invoke-RestMethod "$base/api/items/$rivalId/claims" -Method Post -ContentType application/json `
  -Body (@{verification_message="Bent spoke and a blue handle, this one is mine."} | ConvertTo-Json) -WebSession $s2
$claimB = Invoke-RestMethod "$base/api/items/$rivalId/claims" -Method Post -ContentType application/json `
  -Body (@{verification_message="I left this by the library desk on Tuesday."} | ConvertTo-Json) -WebSession $s3
Invoke-RestMethod "$base/api/claims/$($claimA.id)" -Method Patch -ContentType application/json `
  -Body (@{status="approved";reason="Described the bent spoke unprompted."} | ConvertTo-Json) -WebSession $s | Out-Null
$rivalClaims = (Invoke-RestMethod "$base/api/claims" -WebSession $s) | Where-Object { $_.item_id -eq $rivalId }
Check "approving one claim closes the rival" (($rivalClaims | Where-Object { $_.id -eq $claimB.id }).status -eq "rejected")
Check "only one approved claim per item" ((($rivalClaims | Where-Object { $_.status -eq "approved" }) | Measure-Object).Count -eq 1)
try {
  Invoke-RestMethod "$base/api/claims/$($claimB.id)" -Method Patch -ContentType application/json `
    -Body (@{status="approved"} | ConvertTo-Json) -WebSession $s | Out-Null
  Check "a closed rival cannot be approved later" $false "a second approval landed!"
} catch { Check "a closed rival cannot be approved later" ($_.Exception.Response.StatusCode.value__ -eq 409) }
Invoke-RestMethod "$base/api/items/$rivalId" -Method Delete -WebSession $s | Out-Null

Write-Host "`n== 14c. Update payloads are normalised like creates =="
$normItem = Invoke-RestMethod "$base/api/items" -Method Post -ContentType application/json -WebSession $s `
  -Body (@{type="lost";title="Whitespace probe notebook";category="Other"
           description="Item used to check that PUT trims exactly like POST does."
           location="Cafeteria";date_lost_found="2026-08-18T00:00:00Z"} | ConvertTo-Json)
$normId = $normItem.item.id
$trimmed = Invoke-RestMethod "$base/api/items/$normId" -Method Put -ContentType application/json `
  -Body (@{location="   Student Center   "} | ConvertTo-Json) -WebSession $s
Check "update trims padded values" ($trimmed.location -eq "Student Center")
try {
  Invoke-RestMethod "$base/api/items/$normId" -Method Put -ContentType application/json `
    -Body (@{title="       "} | ConvertTo-Json) -WebSession $s | Out-Null
  Check "update rejects whitespace-only values" $false "it was stored!"
} catch { Check "update rejects whitespace-only values" ($_.Exception.Response.StatusCode.value__ -eq 422) }
Invoke-RestMethod "$base/api/items/$normId" -Method Delete -WebSession $s | Out-Null

Write-Host "`n== 15. Admin dashboard + moderation =="
$sa = $null
Invoke-RestMethod "$base/api/auth/login" -Method Post -ContentType application/json `
  -Body (@{email="admin@uiu.ac.bd";password="UniFind2026"} | ConvertTo-Json) -SessionVariable sa | Out-Null
$astats = Invoke-RestMethod "$base/api/admin/stats" -WebSession $sa
Check "admin stats available" ($astats.total_users -gt 0)
Invoke-RestMethod "$base/api/reports" -Method Post -ContentType application/json `
  -Body (@{target_type="item";target_id=$itemId;reason="Testing the moderation queue."} | ConvertTo-Json) -WebSession $s3 | Out-Null
$reports = Invoke-RestMethod "$base/api/admin/reports" -WebSession $sa
Check "flagged content reaches admin queue" ($reports.Count -gt 0)
Invoke-RestMethod "$base/api/admin/posts/$($privItem.id)/remove" -Method Patch -WebSession $sa | Out-Null
$browseAfter = Invoke-RestMethod "$base/api/items" -WebSession $s2
Check "removed post leaves Browse" (-not ($browseAfter.id -contains $privItem.id))
Invoke-RestMethod "$base/api/admin/posts/$($privItem.id)/restore" -Method Patch -WebSession $sa | Out-Null
$browseRestored = Invoke-RestMethod "$base/api/items" -WebSession $s2
Check "restore puts it back" ($browseRestored.id -contains $privItem.id)

Write-Host "`n== 16. Logout clears the session =="
Invoke-RestMethod "$base/api/auth/logout" -Method Post -WebSession $s | Out-Null
try { Invoke-RestMethod "$base/api/auth/me" -WebSession $s | Out-Null; Check "logout invalidates session" $false "still signed in!" }
catch { Check "logout invalidates session" ($_.Exception.Response.StatusCode.value__ -eq 401) }

Write-Host "`n== 17. Email confirmation + the hard gate =="
if (-not $confirmEmail) {
  # Switched off, so there is no code to check. What must hold instead is that
  # the confirmation endpoints are genuinely inert rather than half-alive.
  foreach ($p in @("/api/auth/pending")) {
    try { Invoke-RestMethod "$base$p" | Out-Null; Check "confirmation is off: $p is inert" $false "it answered!" }
    catch { Check "confirmation is off: $p is inert" ($_.Exception.Response.StatusCode.value__ -eq 404) }
  }
  try {
    Invoke-RestMethod "$base/api/auth/verify" -Method Post -ContentType application/json `
      -Body (@{code="123456"} | ConvertTo-Json) | Out-Null
    Check "confirmation is off: /verify is inert" $false "it answered!"
  } catch { Check "confirmation is off: /verify is inert" ($_.Exception.Response.StatusCode.value__ -eq 404) }
  try {
    Invoke-RestMethod "$base/api/auth/resend" -Method Post | Out-Null
    Check "confirmation is off: /resend is inert" $false "it answered!"
  } catch { Check "confirmation is off: /resend is inert" ($_.Exception.Response.StatusCode.value__ -eq 404) }
  Write-Host "  SKIP  the six-digit gate checks (set UNIFIND_REQUIRE_EMAIL_CONFIRMATION=true to run them)"
} else {

$vEmail = "verify$(Get-Random -Max 99999)@bscse.uiu.ac.bd"
$sv = $null
$vUser = Invoke-RestMethod "$base/api/auth/register" -Method Post -ContentType application/json `
  -Body (@{name="Verify Student";email=$vEmail;password="Password123"} | ConvertTo-Json) `
  -SessionVariable sv

# Development builds return the code so this runs with no SMTP server.
$code = $vUser.verification.dev_code
Check "registration issues a six-digit code" ($code -match '^\d{6}$')

# Hard gate: the pending cookie opens nothing, not even reading.
foreach ($p in @("/api/items","/api/dashboard")) {
  try { Invoke-RestMethod "$base$p" -WebSession $sv | Out-Null; Check "pending cookie cannot read $p" $false "it was allowed!" }
  catch { Check "pending cookie cannot read $p" ($_.Exception.Response.StatusCode.value__ -eq 401) }
}

$vBody = @{
  type="lost"; title="Unconfirmed test item"; category="Other"
  description="This post must be refused until the email is confirmed."
  location="Cafeteria"; date_lost_found="2026-08-16T00:00:00Z"
} | ConvertTo-Json
try {
  Invoke-RestMethod "$base/api/items" -Method Post -ContentType application/json -Body $vBody -WebSession $sv | Out-Null
  Check "unconfirmed member cannot post" $false "the post was accepted!"
} catch { Check "unconfirmed member cannot post" ($_.Exception.Response.StatusCode.value__ -eq 401) }

try {
  Invoke-RestMethod "$base/api/auth/verify" -Method Post -ContentType application/json `
    -Body (@{code="000000"} | ConvertTo-Json) -WebSession $sv | Out-Null
  Check "a wrong code is rejected" $false "it was accepted!"
} catch { Check "a wrong code is rejected" ($_.Exception.Response.StatusCode.value__ -eq 400) }

try {
  Invoke-RestMethod "$base/api/auth/resend" -Method Post -WebSession $sv | Out-Null
  Check "resend is rate limited" $false "no cooldown!"
} catch { Check "resend is rate limited" ($_.Exception.Response.StatusCode.value__ -eq 429) }

$confirmed = Invoke-RestMethod "$base/api/auth/verify" -Method Post -ContentType application/json `
  -Body (@{code=$code} | ConvertTo-Json) -WebSession $sv
Check "the correct code confirms the account" ($confirmed.user.is_verified -eq $true)

# Confirming is also the sign-in: the same session now works everywhere.
$vMe = Invoke-RestMethod "$base/api/auth/me" -WebSession $sv
Check "confirming the code signs the member in" ($vMe.email -eq $vEmail)

$vItem = Invoke-RestMethod "$base/api/items" -Method Post -ContentType application/json -Body $vBody -WebSession $sv
Check "confirmed member can post" ($vItem.item.id -gt 0)

# Signing in with the right password but an unconfirmed address hands back a
# fresh code instead of a session. Its own account, because the new code would
# otherwise invalidate the one used above.
$lEmail = "lapsed$(Get-Random -Max 99999)@bscse.uiu.ac.bd"
Invoke-RestMethod "$base/api/auth/register" -Method Post -ContentType application/json `
  -Body (@{name="Lapsed Student";email=$lEmail;password="Password123"} | ConvertTo-Json) | Out-Null
$sl = $null
try {
  Invoke-RestMethod "$base/api/auth/login" -Method Post -ContentType application/json `
    -Body (@{email=$lEmail;password="Password123"} | ConvertTo-Json) -SessionVariable sl | Out-Null
  Check "unconfirmed login is refused" $false "it signed in!"
} catch { Check "unconfirmed login is refused" ($_.Exception.Response.StatusCode.value__ -eq 403) }
try {
  Invoke-RestMethod "$base/api/auth/me" -WebSession $sl | Out-Null
  Check "the refusal issues no session" $false "it signed in anyway!"
} catch { Check "the refusal issues no session" ($_.Exception.Response.StatusCode.value__ -eq 401) }
$lWaiting = Invoke-RestMethod "$base/api/auth/pending" -WebSession $sl
Check "the refusal sets a pending cookie instead" ($lWaiting.email -eq $lEmail)

}

Write-Host "`n========================================"
Write-Host "  PASSED: $pass    FAILED: $fail"
Write-Host "========================================"
if ($fail -gt 0) { exit 1 }
