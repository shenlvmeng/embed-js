/*
	Author: Shenlvmeng
	Time: 2016/7
	Title: embed-js
	Hint: Use jquery for DOM manipulating
*/
import { Network, VirtualN, SubstrateN } from "./embed-network"
import { VLAN_MAX, Simulation } from "./embed-simulate"

function embed(vnsPerWin, windows, isinf, linkRate, maxCPU, maxBw, maxLife){
	//generate substrate network
	var sn_structure = Network.mkGraph(100, .5, 100, 100, VLAN_MAX);
	var SN = new SubstrateN(sn_structure.nodes, sn_structure.links);
	SN.findKShortestPaths();
	//start simulation
	var test = new Simulation(SN, vnsPerWin, windows);
	test.dispatch(isinf, linkRate, maxCPU, maxBw, maxLife);
	test.print(show);
}

function show(counter, sum, ar, rBc) {
	if(counter != sum)
		$("#display_t").html(sum - counter);
	else
		$("#display_t").html("--");
	//console.log("Total sum: "+sum+" AR: "+ar+" R/C: "+rBc);
	$("#display_s").html(counter);
	$("#display_a").html(ar);
	$("#display_r").html(rBc);
}

$("#submit").on('click', function(event){
	event.preventDefault();
	var vns = parseInt($("#vns").val()) || 10;
	var windows = parseInt($("#wins").val()) || 5;
	var isinf = parseInt($("input[name=isinf]:checked", "#panel").val()) || 1;
	var linkRate = parseFloat($("#linkrate").val()) || .5;
	var maxCPU = parseInt($("#cpu").val()) || 1;
	var maxBw = parseInt($("#bw").val()) || 1;
	var maxLife = parseInt($("#life").val()) || 3;
	embed(vns, windows, isinf, linkRate, maxCPU, maxBw, maxLife);
})