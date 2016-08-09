/*
	Author: Shenlvmeng
	Time: 2016/7
	Title: embed-js
*/
class Node{
	constructor(cpu){
		this.cpu = cpu;
		this.usage = [];
	}
}

class Link{
	constructor(src, dst, bw, vlan){
		this.src = src;
		this.dst = dst;
		this.bw = bw;
		this.vlan = vlan;
		this.usage = [];
	}
}

class Network{
	constructor(nodes, links){
		this.nodes = nodes;
		this.links = links;
		this.nodes.forEach(function(node, i){
			node.id = i;
		});
		this.links.forEach(function(link, i){
			link.id = i;
		});
	}

	get sum_nodes(){ return this.nodes.length; }
	get sum_links(){ return this.links.length; }

	//generate a network(nodes and links)
	static mkGraph(sum_n, linkRate, maxCPU, maxBw, maxVlan) {
		var nodes = [];
		var links = [];
		for(let i = 0; i < sum_n; i++){
			let tmpNode = new Node(Math.random()*maxCPU);
			nodes.push(tmpNode);
		}
		for(let i = 0; i < nodes.length; i++){
			for(let j = i; j < nodes.length; j++){
				if(i == j) continue;
				if(Math.random() <= linkRate){
					let tmpLink = new Link(i, j, Math.random()*maxBw, maxVlan);
					links.push(tmpLink);
				}
			}
		}
		var net = {
			"nodes": nodes, "links": links
		};
		return net;
	}
}
class VirtualN extends Network {
	constructor(id, nodes, links, life){
		super(nodes, links);
		this.id = id;
		this.state = "R" //R: ready NF:Node finished LF:Link finished D:Done P:Postponed
		this.tryCounts = 0;
		this.life = life || 1;
		this.revenue =  this.nodes.reduce(function(prev, curr){
			return prev + curr.cpu;
		}) + this.links.reduce(function(prev, curr){
			return prev + curr.bw + 1;
		});
	}
}
class SubstrateN extends Network {
	//except: two nodes of the same vn cannot be mapped onto the same substrate node
	getMaxWeightedNode(except) {
		var weights = new Array(this.sum_nodes).fill(0);
		this.links.forEach(function(link){
			weights[link.src] += link.bw;
			weights[link.dst] += link.bw;
		});
		this.nodes.forEach(function(node, i){
			weights[i] *= node.cpu;
		});
		let max = {
			"id" : -1,
			"value": 0
		};
		weights.forEach(function(val, i){
			if(val > max.value && this.nodes[i].usage.indexOf(except) == -1){
				max.id = i;
				max.value = val;
			}
		});
		return max.id;
	}

	alterNodeResource(node, val, type, vnid){
		if(type === "add"){
			console.log("Release cpu " + val);
			this.nodes[node].cpu += val;
			var tmpid = this.nodes[node].usage.indexOf(vnid);
			if(tmpid != -1) this.nodes[node].usage.splice(tmpid, 1);
		} else if(type === "sub"){
			if(this.nodes[node].cpu < val) throw new Error("Node "+node+" CPU is not enough!");
			console.log("Consume cpu " + val);
			this.nodes[node].cpu -= val;
			this.nodes[node].usage.push(vnid);
		} else
			throw new Error("Unknown alter node resource type!");
	}

	alterLinksResource(links, val, type, vnid) {
		if(type === "add"){
			console.log("Release bw " + val);
			links.forEach(function(link){
				this.links[link].bw += val;
				this.links[link].vlan += 1;
				this.links[link].usage.splice(this.links[link].usage.indexOf(vnid), 1);
			});
		} else if (type === "sub"){
			if(links.every(function(link){ return this.links[link].bw >= val && this.links[link].vlan > 0;})){
				links.forEach(function(link){
					this.links[link].bw -= val;
					this.links[link].vlan -= 1;
					this.links[link].usage.push(vnid);
				});
			} else
				throw new Error("Link resource not met!");
		} else
			throw new Error("Unknown alter links resource type!");
	}

	findKShortestPaths() {
		var weights = [];
		this.paths = [];

		for(let i = 0; i < this.nodes; i++){
			for(let j = 0; j < this.nodes; j++){
				if(i == j){
					weights[i][j] = 0;
					this.paths[i][j] = i;
				} else {
					weights[i][j] = 10000;
					this.paths[i][j] = -1;
				}
			}
		}

		for(let link in this.links){
			if(link.src < 0 || link.dst < 0) continue;
			weights[link.src][link.dst] = 1;
			this.paths[link.src][link.dst] = i;
		}

		for(let k = 0; k < this.nodes; k++){
			for(let i = 0; i < this.nodes; i++){
				for(let j = 0; j < this.nodes; j++){
					if(weights[i][k]+weights[k][j] < weights[i][j])
						this.paths[i][j] = path[k][j];
				}
			}
		}
	}
}

export { Network, VirtualN, SubstrateN }