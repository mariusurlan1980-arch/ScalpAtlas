package com.scalpatlas.app

/**
 * Version 398: broker-specific capabilities, separate from the SHOCK analyzer.
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

  // This describes adapter availability, not permission to place an order.
  // Account, stake, payout, UI and position state require independent checks.
  fun hasDemoExecutor(pkg: String): Boolean =
    forPackage(pkg).demoOrderAdapterAvailable

  fun hasRealExecutor(pkg: String): Boolean =
    forPackage(pkg).realOrderAdapterAvailable
}
