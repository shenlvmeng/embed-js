/*
	Author: Shenlvmeng
	Time: 2016/7
	Title: embed-js
*/
import { Network, VirtualN, SubstrateN } from './embed-network'

const VLAN_MAX = 4096;
const RETRY_TIMES = 2;
const MIN_NODE_PER_REQ = 3;

class Simulation {
	constructor(sn, vnsPerWin, windows){
		this.sn = sn;
		this.vnsPerWin = vnsPerWin;   //vnsPerWin >= 2;
		this.windows = windows;
		this.counter = 0;
		this.currSum = 0;
		this.succRev = 0;
		this.succCos = 0;
		this.succSum = 0;
		this.failSum = 0;
		//Two queues for ready requests and postponed requests
		this.readyQueue = [];
		this.postpQueue = [];
		this.inQueue = [];
	}
	//use greedy algorithm
	mapNode(vnid){
		var vn = this.readyQueue[vnid];
		if(vn.state != "R"){
			throw new Error("Wrong state("+ vn.state +") of request "+ vn.id +"in ready queue.");
			return -1;
		}
		vn.nodes.forEach((node) => {
			var maxid = this.sn.getMaxWeightedNode(vn.id);
			if(maxid < 0 && node.cpu > this.sn.nodes[maxid].cpu){
				//console.log("Node "+ maxid + " CPU is not abundant.\n");
				//console.log("Req "+ vn.id +"in ready queue is failed in node mapping.")
				vn.nodes.forEach((node) => {
					if(node.usage.length > 0)
						this.sn.alterNodeResource(node.usage[0], node.cpu, "add", vn.id);
				});
				if(vn.tryCounts < RETRY_TIMES){
					vn.tryCounts += 1;
					this.postpQueue.push(vn);
					vn.state = "P";
				}
				this.readyQueue.splice(vnid, 1);
				return -1;
			} 
			node.usage.push(maxid);
			this.sn.alterNodeResource(maxid, node.cpu, "sub", vn.id);
		});
		vn.state = "NF";
		return 0;
	}
	//use k shortest algorithm
	mapLink2Steps(vnid, isinf) {
		var vn = this.readyQueue[vnid],
			tmplinks = [],
			flag = 0,
			cost = 0,
			sn_back = this.sn;
		if(vn.state != "NF"){
			throw new Error("Wrong state("+ vn.state +") of request "+ vn.id +"in ready queue.");
			return -1;
		}
		for(let i = 0, len = vn.links.length; i < len; i++){
			let link = vn.links[i],
				l_from = vn.nodes[link.src].usage[0],
				l_to   = vn.nodes[link.dst].usage[0];
				tmplinks = [];
			while(l_from != l_to) {
				let next = this.sn.paths[l_from][l_to];
				//which means 'from' cannot get to 'to'
				if(next == -1) {
					flag = 2;
					break;
				}
				var index = this.sn.links.findIndex(function(l){
					return (l.src == l_from && l.dst == next) || (l.src == next && l.dst == l_from);
				});
				if(index == -1 || this.sn.links[index].bw < link.bw || this.sn.links[index].vlan < 1) {
					flag = 1;
					break;
				}
				tmplinks.push(index);
				l_from = next;
			}
			//find k paths until the graph is splitted
			if(flag == 1){
				while(flag == 1){
					tmplinks = [];
					this.sn.links[index].src = -1;
					this.sn.links[index].dst = -1;
					this.sn.findKShortestPaths();
					l_from = vn.nodes[link.src].usage[0];
					flag = 0;		
					while(l_from != l_to) {
						let next = this.sn.paths[l_from][l_to];
						//which means 'from' cannot get to 'to'
						if(next == -1) {
							flag = 2;
							break;
						}
						var index = this.sn.links.findIndex(function(l){
							return (l.src == l_from && l.dst == next) || (l.src == next && l.dst == l_from);
						});
						if(index == -1 || this.sn.links[index].bw < link.bw || this.sn.links[index].vlan < 1) {
							flag = 1;
							break;
						}
						tmplinks.push(index);
						l_from = next;
					}
				}
			}
			if(flag == 0){
				cost += link.bw * (tmplinks.length-1);
				console.log("Alter link resources for VN "+vn.id);
				this.sn.alterLinksResource(tmplinks, link.bw, "sub", vn.id);
			}
			else if(flag == 2) {
				//release all resources and change state
				console.log("Request "+ vn.id +" link mapping failed.")
				vn.nodes.forEach((node) => {
					if(node.usage.length == 0) throw new Error("Node resource error in link resource releasing.")
					this.sn.alterNodeResource(node.usage[0], node.cpu, "add", vn.id);
				});
				vn.links.forEach((link) => {
					if(link.usage.length > 0)
						this.sn.alterLinksResource(link.usage, link.bw, "add", vn.id);
				});
				if(vn.tryCounts < RETRY_TIMES){
					vn.tryCounts += 1;
					this.postpQueue.push(vn);
					vn.state = "P";
				}
				break;
			}

		}
		this.sn = sn_back;
		if(flag == 0){
			this.succRev += vn.revenue;
			this.succCos += cost + vn.revenue;	
			this.succSum += 1;
			vn.state = "LF";
			return 0;
		}
		return -1;
	}
	dispatch(isinf, linkRate, maxCPU, maxBw, maxLife){
		var win = Math.min(this.windows, 1000);
		console.log("Total time windows: "+ win);
		for(let k = 0; k < win; k++){
			console.log("Time window No."+ (k+1));
			//handle requests already embedded in the substrate network
			//this step is ommited when testing capacity
			if(!isinf){
				for(let i = 0; i < this.inQueue.length; i++){
					if(this.inQueue[i].life <= k){
						//release resources of done requests
						let doneReq = this.inQueue[i];
						if(doneReq.state != "LF") throw new Error("Uncorrect state in inQueue!");
						console.log("Release resources of request "+ doneReq.id);
						doneReq.nodesforEach((node) => {
							if(node.usage.length == 0) throw new Error("Node resource error in link resource releasing.")
							this.sn.alterNodeResource(node.usage[0], node.cpu, "add", doneReq.id);
						});
						doneReq.links.forEach((link) => {
							if(link.usage.length > 0)
								this.sn.alterLinksResource(link.usage, link.bw, "add", doneReq.id);
						});
						this.inQueue.splice(i, 1);
					}
				}
			}
			//move postponed requests to the ready queue
			while(this.postpQueue.length != 0){
				let tmpPostReq = this.postpQueue.pop();
				tmpPostReq.state = "R";
				this.readyQueue.push(tmpPostReq);
				this.failSum -= 1;
			}
			//generate random new requests
			let randomSum = Math.floor(Math.random() * (this.vnsPerWin + 1) + this.vnsPerWin * 1/2);
			for(let j = 0; j < randomSum; j++){
				let tmpNode = Math.floor(Math.random() * 7 + MIN_NODE_PER_REQ);
				let tmpReq = Network.mkGraph(tmpNode, linkRate, maxCPU, maxBw, VLAN_MAX);
				let tmpLife = (isinf ? 0 : k + 1 + Math.floor(Math.random() * maxLife));
				let req = new VirtualN(this.counter, tmpReq.nodes, tmpReq.links, tmpLife);
				this.counter++;
				this.readyQueue.push(req);
			}
			//sort reqs then try to map them to the substrate network
			this.readyQueue.sort(function(a, b){
				return b.revenue - a.revenue;
			});
			while(this.readyQueue.length > 0){
				if(this.readyQueue[0].state != "R")
					throw new Error("Request in ready queue with uncorrect state: "+ this.readyQueue[0].state);
				if(this.mapNode(0) != 0)
					this.failSum += 1;
				else {
					if(this.mapLink2Steps(0, isinf) == 0){
						if(!isinf)
							this.inQueue.push(this.readyQueue[0]);
					} else 
						this.failSum += 1;
				}
				this.currSum += 1;
				this.readyQueue.shift();
			}
		}
	}
	print(callback){
		callback(this.counter, this.currSum, this.calcAR(), this.calcRC());
	}
	calcRC(){
		return this.succRev / this.succCos;
	}
	calcAR(){
		return 1 - (this.failSum / this.counter);
	}
}

export { VLAN_MAX, Simulation } 