package com.scalpatlas.app
fun main(){
  val p=LiveMartingalePreview637
  val pair="AED/CNY OTC"
  check(p.parse(listOf("AED/CNY OTC WIN Profit net: +1.00"),pair,109)?.let{p.next(109,it)}==109L)
  check(p.parse(listOf("AED/CNY OTC LOSS P/L: -1.09"),pair,109)?.let{p.next(109,it)}==228L)
  check(p.parse(listOf("AUD/USD OTC LOSS P/L: -1.09"),pair,109)==null)
  check(p.parse(listOf("AED/CNY OTC LOSS P/L: -0.10"),pair,109)==null)
  check(p.parse(listOf("AED/CNY OTC WIN Profit net: +1.00","AED/CNY OTC LOSS P/L: -1.09"),pair,109)==null)
  check(p.parse(listOf("AED/CNY OTC LOSS"),pair,109)==null)
  check(p.next(81950,LiveMartingalePreview637.Result(pair,-81950,false))==null)
  check(p.ladder.sum()==157244L)
  println("PASS: 8 synthetic preview cases")
}
