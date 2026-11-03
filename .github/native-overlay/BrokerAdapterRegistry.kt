package com.scalpatlas.app

/**
 * Version 399: broker-specific capabilities, separate from the SHOCK analyzer.
 * The screen analyzer may observe any user-selected broker. A physical order
 * requires an explicitly verified broker adapter; no generic coordinate taps.
 */
object BrokerAdapterRegistry {
  enum class Account { DEMO, REAL, UNKNOWN }
  data class Capabilities(
    val id: String,
    val canScan: Boolean,
    val demoOrderAdapterAvailable: Boolean,
    val realOrderAdapterAvailable: Boolean
  )

  fun forPackage(pkg: String): Capabilities = when (pkg) {
    "com.pocketoption.broker", "com.potradeweb" -> Capabilities(
      id = "pocket-option",
      canScan = true,
      demoOrderAdapterAvailable = true,
      realOrderAdapterAvailable = false
    )
    else -> Capabilities(
      id = "unrecognized",
      canScan = true,
      demoOrderAdapterAvailable = false,
      realOrderAdapterAvailable = false
    )
  }

  /**
   * Read-only identification from visible broker header labels.
   * A package name alone never proves DEMO or REAL. Mixed/hidden labels
   * intentionally produce UNKNOWN rather than a guessed account.
   */
  data class AccountObservation(
    val brokerId: String,
    val account: Account,
    val verified: Boolean,
    val demoExecutorAllowed: Boolean,
    val realExecutorAllowed: Boolean
  )

  fun observeAccount(pkg: String, visibleHeaderLabels: List<String>): AccountObservation {
    val broker = forPackage(pkg)
    if (broker.id == "unrecognized") {
      return AccountObservation(broker.id, Account.UNKNOWN, false, false, false)
    }
    val demo = visibleHeaderLabels.any {
      Regex("""(?i)\\bQT\\s*Demo\\b""").containsMatchIn(it)
    }
    val real = visibleHeaderLabels.any {
      Regex("""(?i)\\bQT\\s*Real\\b""").containsMatchIn(it)
    }
    val account = when {
      demo == real -> Account.UNKNOWN
      demo -> Account.DEMO
      else -> Account.REAL
    }
    return AccountObservation(
      brokerId = broker.id,
      account = account,
      verified = account != Account.UNKNOWN,
      demoExecutorAllowed = account == Account.DEMO && broker.demoOrderAdapterAvailable,
      // There is NO broker-verified REAL executor in 399.
      realExecutorAllowed = account == Account.REAL && broker.realOrderAdapterAvailable
    )
  }

  // This describes adapter availability, not permission to place an order.
  // Account, stake, payout, UI and position state require independent checks.
  fun hasDemoExecutor(pkg: String): Boolean =
    forPackage(pkg).demoOrderAdapterAvailable

  fun hasRealExecutor(pkg: String): Boolean =
    forPackage(pkg).realOrderAdapterAvailable
}
