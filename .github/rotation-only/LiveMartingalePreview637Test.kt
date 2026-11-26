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
  check(p.format(109)=="1,09")
  check(p.format(228)=="2,28")
  check(p.permitsEdit(109,228,109,157232,0,157232))
  check(!p.permitsEdit(109,228,109,157232,null,157232))
  check(!p.permitsEdit(109,228,109,157232,1,157232))
  check(!p.permitsEdit(109,228,109,157232,0,157231))
  check(!p.permitsEdit(109,228,228,157232,0,157232))
  check(!p.permitsEdit(109,228,109,200,0,200))
  check(!p.permitsEdit(109,null,109,157232,0,157232))
  println("PASS: 17 synthetic calculation and stake authorization cases")
}
