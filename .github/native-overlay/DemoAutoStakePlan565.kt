package com.scalpatlas.app

import android.content.SharedPreferences

/**
 * 565: QT DEMO-only, opt-in stake PREPARATION after broker-verifiable CLOSED
 * results. This class NEVER places BUY/SELL or infers settlement from timer,
 * screen color, a click, or an empty Open tab.
 *
 * Ten-level ladder: after every verified LOSS propose the next stake;
 * after a verified WIN reset to $1.09. Stop after TEN losses OR before
 * any stake outside the budget. $1,572.44 is planned, NOT broker-verified. Ten LOSS can consume it all.
 */
internal class DemoAutoStakePlan565(private val prefs: SharedPreferences) {
  companion object {
    const val PLANNED_BUDGET_CENTS = 157244L
    const val PAYOUT_EXACT = 92
    const val STOP_AFTER_LOSSES = 10
    const val EDITOR_MAX_STAKE_CENTS = 81950L
    private val LADDER = longArrayOf(109L,228L,475L,992L,2070L,
      4320L,9016L,18816L,39268L,81950L)
  }
  data class Proposal(val stakeCents: Long?, val pair: String?, val reason: String)

  @Synchronized
  fun isEnabled(): Boolean = prefs.getBoolean("enabled",false)

  @Synchronized
  fun isRiskStopped(): Boolean = prefs.getBoolean("riskStopped",false)

  @Synchronized
  fun enableFromVerifiedDemo(accountKey: String, pair: String): Boolean {
    if (isRiskStopped() || !accountKey.startsWith("QT_DEMO:") ||
        accountKey.length < 10 || pair.isBlank() || pair=="NEIDENTIFICAT")
      return false
    val storedAccount=prefs.getString("accountKey",null)
    if(storedAccount!=null && storedAccount!=accountKey)return false
    val losses=prefs.getInt("losses",0)
    if(losses !in 0 until STOP_AFTER_LOSSES)return false
    val storedPair=prefs.getString("pair",null)
    // On resume, keep the same pair until the next planned stake is read back.
    if(storedPair!=null && storedPair!=pair && losses>0)return false
    val pending=prefs.getLong("pendingStake",0L)
    val expected=LADDER[losses]
    val cumLoss=(0 until losses).sumOf { LADDER[it] }
    if (cumLoss + expected > PLANNED_BUDGET_CENTS ||
        expected > EDITOR_MAX_STAKE_CENTS) return false
    if(pending!=0L && pending!=expected)return false
    return prefs.edit()
      .putBoolean("enabled",true)
      .putString("accountKey",accountKey)
      .putString("pair",pair)
      .putLong("pendingStake",expected)
      .putString("status","MIZĂ QT DEMO ${expected/100}.${(expected%100).toString().padStart(2,'0')} USD • AȘTEAPTĂ CONFIRMARE")
      .commit()
  }

  @Synchronized
  private fun stopUnsafe(reason:String): String {
    prefs.edit().putBoolean("riskStopped",true)
      .putBoolean("enabled",false).putLong("pendingStake",0L)
      .putString("status","STOP DEMO • " + reason.take(80)).commit()
    return "STOP DEMO • " + reason.take(80)
  }

  @Synchronized
  fun disable(): Boolean = prefs.edit()
    .putBoolean("enabled",false)
    .putLong("pendingStake",0L)
    .putString("status","MIZĂ AUTO OFF • FĂRĂ MODIFICĂRI")
    .commit()

  /** Called only when the native analyzer has proven the SAME OPEN/CLOSED
   * order, two independent CLOSED detail reads, two empty-OPEN reads and
   * an exact broker-account/pair/stake/time/payout match.
   * It remains idempotent through process death or observer duplication.
   */
  @Synchronized
  fun onVerifiedClosed(
    accountKey: String, pair: String, positionId: String,
    stakeCents: Long, payoutPercent: Int, netProfitCents: Long,
    matchingOpenClosedAndZeroOpen: Boolean
  ): String {
    if (!isEnabled()) return "MIZĂ AUTO OFF"
    if (!matchingOpenClosedAndZeroOpen ||
        !accountKey.startsWith("QT_DEMO:") ||
        accountKey!=prefs.getString("accountKey",null) ||
        pair!=prefs.getString("pair",null) || positionId.isBlank() ||
        payoutPercent!=PAYOUT_EXACT ||
        isRiskStopped())
      return stopUnsafe("ÎNCHIDERE/CONT/PAYOUT NECONFIRMATE")
    val ids=prefs.getStringSet("seenClosedIds",emptySet()).orEmpty()
    if(positionId in ids)return "DUPLICAT CLOSED • MIZĂ NESCHIMBATĂ"
    val losses=prefs.getInt("losses",0)
    val pending=prefs.getLong("pendingStake",0L)
    if(losses !in 0 until STOP_AFTER_LOSSES || pending != 0L ||
        stakeCents!=LADDER[losses])
      return stopUnsafe("MIZĂ ANTERIOARĂ/EDITARE NECONFIRMATĂ")
    val nextIds=(ids+positionId).toList().takeLast(100).toSet()
    // The broker must report the WHOLE stake lost; a partial/unknown
    // settlement is not Martingale LOSS evidence.
    if(netProfitCents<0L && netProfitCents != -stakeCents)
      return stopUnsafe("LOSS PARȚIAL/NECONFORM")
    // A nominal WIN at exact 92% must settle at the known cent range.
    if(netProfitCents>0L &&
        netProfitCents !in ((stakeCents*92L)/100L)..((stakeCents*92L+99L)/100L))
      return stopUnsafe("WIN/PAYOUT NECONFORM")
    val edit=prefs.edit().putStringSet("seenClosedIds",nextIds)
    if(netProfitCents<0L){
      val nextLosses=losses+1
      val cumLoss=(0 until nextLosses).sumOf{LADDER[it]}
      if(nextLosses>=STOP_AFTER_LOSSES) {
        edit.putInt("losses",nextLosses)
          .putLong("cumulativeLoss",cumLoss)
          .putLong("pendingStake",0L)
          .putBoolean("riskStopped",true)
          .putBoolean("enabled",false)
          .putString("status","STOP • 10 LOSS DEMO • FĂRĂ ORDIN")
        return if(edit.commit())"STOP • 10 LOSS CONFIRMATE" else "EROARE PERSISTENȚĂ • BLOCARE"
      }
      val next=LADDER[nextLosses]
      if(cumLoss+next>PLANNED_BUDGET_CENTS ||
          next>EDITOR_MAX_STAKE_CENTS){
        edit.putInt("losses",nextLosses).putLong("cumulativeLoss",cumLoss)
          .putBoolean("riskStopped",true)
          .putBoolean("enabled",false)
          .putLong("pendingStake",0L)
          .putString("status","STOP • MIZĂ SAU BUGET DEPĂȘIT")
        return if(edit.commit())"STOP • BUGET/LIMITĂ ANDROID" else "EROARE PERSISTENȚĂ • BLOCARE"
      }
      edit.putInt("losses",nextLosses)
        .putLong("cumulativeLoss",cumLoss)
        .putLong("pendingStake",next)
        .putString("status","LOSS CONFIRMAT • EDITEZ MIZA ${next/100}.${(next%100).toString().padStart(2,'0')} USD")
      return if(edit.commit())"LOSS CONFIRMAT • MIZĂ PREGĂTITĂ" else "EROARE PERSISTENȚĂ • BLOCARE"
    }
    if(netProfitCents==0L){
      edit.putLong("pendingStake",LADDER[losses])
        .putString("status","DRAW • REFAC ACEEAȘI MIZĂ")
      return if(edit.commit())"DRAW CONFIRMAT • MIZĂ NEMĂRITĂ" else "EROARE PERSISTENȚĂ"
    }
    // Verified WIN finishes the series. Only the next fresh cycle resets.
    edit.putInt("losses",0).putLong("cumulativeLoss",0L)
      .putLong("pendingStake",LADDER[0])
      .putString("status","WIN CONFIRMAT • RESET MIZĂ 1,09 USD")
    return if(edit.commit())"WIN CONFIRMAT • RESET 1,09 USD" else "EROARE PERSISTENȚĂ"
  }

  @Synchronized
  fun pending(accountKey:String, pair:String):Proposal {
    if(!isEnabled())return Proposal(null,null,"MIZĂ AUTO OFF")
    if(isRiskStopped())return Proposal(null,null,"STOP RISC • MIZĂ NEMODIFICATĂ")
    if(accountKey!=prefs.getString("accountKey",null) ||
        pair!=prefs.getString("pair",null))
      return Proposal(null,null,"ALT CONT/PERECHE • FĂRĂ EDITARE")
    val losses=prefs.getInt("losses",0)
    val stake=prefs.getLong("pendingStake",0L)
    val cumLoss=(0 until losses.coerceIn(0, STOP_AFTER_LOSSES))
      .sumOf { LADDER[it] }
    if(losses !in 0 until STOP_AFTER_LOSSES ||
        stake==0L || stake!=LADDER[losses] ||
        cumLoss+stake>PLANNED_BUDGET_CENTS ||
        stake>EDITOR_MAX_STAKE_CENTS)
      return Proposal(null,null,"NIMIC DE EDITAT SAU MIZĂ BLOCATĂ")
    return Proposal(stake,pair,"AȘTEAPTĂ SET_TEXT ȘI RECITIRE BROKER")
  }

  @Synchronized
  fun confirmEdited(accountKey:String, pair:String,
    stakeCents:Long, readBackConfirmed:Boolean):Boolean {
    val losses=prefs.getInt("losses",0)
    // Fail closed before indexing the ladder or adding a sentinel value.
    if(losses !in 0 until STOP_AFTER_LOSSES) return false
    val cumLoss=(0 until losses).sumOf { LADDER[it] }
    if(!readBackConfirmed || !isEnabled() ||
        stakeCents<0L || cumLoss+stakeCents>PLANNED_BUDGET_CENTS ||
        accountKey!=prefs.getString("accountKey",null) ||
        pair!=prefs.getString("pair",null) ||
        prefs.getLong("pendingStake",0L)!=stakeCents ||
        stakeCents!=LADDER[prefs.getInt("losses",0)] ||
        isRiskStopped())return false
    return prefs.edit().putLong("pendingStake",0L)
      .putLong("confirmedStake",stakeCents)
      .putString("status","MIZĂ QT DEMO CONFIRMATĂ • FĂRĂ ORDIN")
      .commit()
  }

  @Synchronized
  fun permitsFreshDemoOrder(
    accountKey:String,pair:String,stakeCents:Long
  ):Boolean {
    if(!isEnabled() || isRiskStopped() ||
        prefs.getLong("pendingStake",-1L)!=0L ||
        accountKey!=prefs.getString("accountKey",null) ||
        pair!=prefs.getString("pair",null) ||
        stakeCents!=prefs.getLong("confirmedStake",-1L))
      return false
    val losses=prefs.getInt("losses",0)
    return losses in 0 until STOP_AFTER_LOSSES &&
      (0 until losses).sumOf { LADDER[it] } + stakeCents <= PLANNED_BUDGET_CENTS &&
      stakeCents==LADDER[losses]
  }

  @Synchronized
  fun status():String=prefs.getString("status","MIZĂ AUTO OFF")
    ?: "MIZĂ AUTO OFF"
}
