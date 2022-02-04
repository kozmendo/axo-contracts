const { expect, assert } = require("chai");
const { network, ethers } = require("hardhat");
const { beforeEach } = require("mocha");
const { start } = require("repl");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

describe.only("Test Bubbles Airdrop", function () {
    let accounts;
    let airdropFactory;
    let airdropContract;
    let merkleTreeDB;
    let merkleTree;
    let bubblesContract;

    const c_bubblesContract = "0x58f46F627C88a3b217abc80563B9a726abB873ba";
    const c_verboseLogging = true;

    // Helper functions
    function merkleMaker() {}
    function convertEntryToHash(entry) {
        let packedEntry = ethers.utils.concat([
            ethers.utils.arrayify(entry.address),
            ethers.utils.zeroPad(entry.balance, 32),
        ]);

        // if (c_verboseLogging) {
        //   console.log("entryToHash: " + "0x"+Buffer.from(keccak256("0x"+Buffer.from(packedEntry).toString('hex'))).toString('hex'));
        // }

        // returns the value of sol: keccak256(abi.encodePacked(msg.sender, _amount));
        return (
            "0x" +
            Buffer.from(
                keccak256("0x" + Buffer.from(packedEntry).toString("hex"))
            ).toString("hex")
        );
    }

    beforeEach(async () => {
        // {
        //     if (c_verboseLogging) {
        //         console.log("\n**********beforeEach**********");
        //     }
        // }

        await ethers.provider.send("hardhat_reset", [
            {
                forking: {
                    jsonRpcUrl:
                        "https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
                    blockNumber: 14135835,
                },
            },
        ]);
        if (accounts == null) {
            accounts = await hre.ethers.getSigners();
        }
        // DataStructure of {address, balance}, used as leaf nodes of MerkleTree
        merkleTreeDB = [
            {
                address: accounts[10].address,
                balance: 10,
            },
            {
                address: accounts[11].address,
                balance: 11,
            },
            {
                address: accounts[12].address,
                balance: 12,
            },
            {
                address: accounts[13].address,
                balance: 13,
            },
        ];

        const leafNodes = merkleTreeDB.map(convertEntryToHash);
        merkleTree = new MerkleTree(leafNodes, keccak256, { sortPairs: true });
        // {
        //     if (c_verboseLogging) {
        //         console.log("merkleTree: %s", merkleTree.toString());
        //     }
        // }

        if (airdropFactory == null) {
            airdropFactory = await hre.ethers.getContractFactory(
                "BubblesAirdrop"
            );
        }

        airdropContract = await airdropFactory.deploy(c_bubblesContract);
        await airdropContract.deployed();

        // {
        //     if (c_verboseLogging) {
        //         console.log("airdropContract address: %s", airdropContract.address);
        //     }
        // }

        await airdropContract.setMerkleRoot(merkleTree.getRoot());
        // {
        //     if (c_verboseLogging) {
        //         console.log("airdropContract merkleRoot: %s", await airdropContract.merkleRoot());
        //         console.log("airdropContract version: %s", await airdropContract.version());
        //     }
        // }

        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: ["0xb0151D256ee16d847F080691C3529F316b2D54b3"],
        });
        n8 = await ethers.getSigner(
            "0xb0151D256ee16d847F080691C3529F316b2D54b3"
        );
        bubblesContract = new ethers.Contract(
            c_bubblesContract,
            require("./BubblesContractABI.json"),
            n8
        );
        await bubblesContract
            .connect(n8)
            .setMinter(airdropContract.address, true);
        await network.provider.request({
            method: "hardhat_stopImpersonatingAccount",
            params: ["0xb0151D256ee16d847F080691C3529F316b2D54b3"],
        });
        // {
        //   if (c_verboseLogging) {
        //       console.log("approved airdropContract to mint Bubbles");
        //   }
        // }
    });

    it("Claim for valid leaf node", async function () {
        {
            if (c_verboseLogging) {
                console.log("\n**********Claim for valid leaf node**********");
            }
        }
        let caller = {
            address: accounts[10].address,
            balance: 10,
        };
        let callerHash = convertEntryToHash(caller);
        let callerProof = merkleTree.getHexProof(callerHash);

        let bubbleBalance = await bubblesContract.balanceOf(
            accounts[10].address
        );
        {
            if (c_verboseLogging) {
                console.log(
                    "bubbleBalance of accounts[10] before claim: %s",
                    bubbleBalance
                );
            }
        }
        await airdropContract
            .connect(accounts[10])
            .claimAirdrop(10, callerProof);

        {
            if (c_verboseLogging) {
                console.log(
                    "bubbleBalance of accounts[10] after claim: %s",
                    await bubblesContract.balanceOf(accounts[10].address)
                );
            }
        }
        expect(bubbleBalance).to.be.lt(
            await bubblesContract.balanceOf(accounts[10].address)
        );
    });

    it("Claim for valid address but already claimed", async function () {
        {
            if (c_verboseLogging) {
                console.log(
                    "\n**********Claim for valid address but already claimed**********"
                );
                console.log("Try claim for accounts[10]");
            }
        }

        let caller = {
            address: accounts[10].address,
            balance: 10,
        };
        let callerHash = convertEntryToHash(caller);
        let callerProof = merkleTree.getHexProof(callerHash);
        let bubbleBalance = await bubblesContract.balanceOf(
            accounts[10].address
        );
        {
            if (c_verboseLogging) {
                console.log(
                    "bubbleBalance of accounts[10] before claim: %s",
                    bubbleBalance
                );
            }
        }

        await airdropContract
            .connect(accounts[10])
            .claimAirdrop(10, callerProof);

        let newBubbleBalance = await bubblesContract.balanceOf(
            accounts[10].address
        );
        {
            if (c_verboseLogging) {
                console.log("accounts[10] has claimed successfully");
                console.log(
                    "bubbleBalance of accounts[10] after claim: %s",
                    newBubbleBalance
                );
            }
        }
        expect(newBubbleBalance).to.be.gt(bubbleBalance);

        caller = {
            address: accounts[10].address,
            balance: 10,
        };
        callerHash = convertEntryToHash(caller);
        callerProof = merkleTree.getHexProof(callerHash);
        await expect(
            airdropContract.connect(accounts[10]).claimAirdrop(10, callerProof)
        ).to.be.revertedWith("Already claimed!");
        {
            if (c_verboseLogging) {
                console.log(
                    "bubbleBalance of accounts[10] after reverted claim: %s",
                    await bubblesContract.balanceOf(accounts[10].address)
                );
            }
        }
        expect(newBubbleBalance).to.be.equal(
            await bubblesContract.balanceOf(accounts[10].address)
        );
    });

    it("Claim for valid address with invalid proof", async function () {
        {
            if (c_verboseLogging) {
                console.log(
                    "\n**********Claim for valid address with invalid proof**********"
                );
            }
        }

        caller = {
            address: accounts[10].address,
            balance: 0,
        };
        callerHash = convertEntryToHash(caller);
        callerProof = merkleTree.getHexProof(callerHash);
        let bubbleBalance = await bubblesContract.balanceOf(
            accounts[10].address
        );
        {
            if (c_verboseLogging) {
                console.log(
                    "bubbleBalance of accounts[10] before claim: %s",
                    bubbleBalance
                );
            }
        }
        await expect(
            airdropContract.connect(accounts[10]).claimAirdrop(10, callerProof)
        ).to.be.revertedWith("Verification failed!");
        {
            if (c_verboseLogging) {
                console.log(
                    "bubbleBalance of accounts[10] after claim: %s",
                    await bubblesContract.balanceOf(accounts[10].address)
                );
            }
        }
        expect(bubbleBalance).to.be.equal(
            await bubblesContract.balanceOf(accounts[10].address)
        );
    });

    it("Claim for valid address but wrong balance", async function () {
        {
            if (c_verboseLogging) {
                console.log(
                    "\n**********Claim for valid address but wrong balance**********"
                );
            }
        }

        caller = {
            address: accounts[10].address,
            balance: 10,
        };
        callerHash = convertEntryToHash(caller);
        callerProof = merkleTree.getHexProof(callerHash);
        let bubbleBalance = await bubblesContract.balanceOf(
            accounts[10].address
        );
        {
            if (c_verboseLogging) {
                console.log(
                    "bubbleBalance of accounts[10] before claim: %s",
                    bubbleBalance
                );
            }
        }
        await expect(
            airdropContract.connect(accounts[10]).claimAirdrop(20, callerProof)
        ).to.be.revertedWith("Verification failed!");
        {
            if (c_verboseLogging) {
                console.log(
                    "bubbleBalance of accounts[10] after claim: %s",
                    await bubblesContract.balanceOf(accounts[10].address)
                );
            }
        }
        expect(bubbleBalance).to.be.equal(
            await bubblesContract.balanceOf(accounts[10].address)
        );
    });

    it("Claim for invalid address with valid proof", async function () {
        {
            if (c_verboseLogging) {
                console.log(
                    "\n**********Claim for invalid address with valid proof**********"
                );
            }
        }

        caller = {
            address: accounts[10].address,
            balance: 10,
        };
        callerHash = convertEntryToHash(caller);
        callerProof = merkleTree.getHexProof(callerHash);
        let bubbleBalance = await bubblesContract.balanceOf(
            accounts[1].address
        );
        {
            if (c_verboseLogging) {
                console.log(
                    "bubbleBalance of accounts[1] before claim: %s",
                    bubbleBalance
                );
            }
        }
        await expect(
            airdropContract.connect(accounts[1]).claimAirdrop(10, callerProof)
        ).to.be.revertedWith("Verification failed!");
        {
            if (c_verboseLogging) {
                console.log(
                    "bubbleBalance of accounts[1] after claim: %s",
                    await bubblesContract.balanceOf(accounts[1].address)
                );
            }
        }
        expect(bubbleBalance).to.be.equal(
            await bubblesContract.balanceOf(accounts[1].address)
        );
    });

    it("Claim for accounts[10], deploy a new merkle tree, and claim again", async function () {
        {
            if (c_verboseLogging) {
                console.log(
                    "\n**********Claim for accounts[10], deploy a new merkle tree, and claim again**********"
                );
            }
        }
        let caller = {
            address: accounts[10].address,
            balance: 10,
        };
        let callerHash = convertEntryToHash(caller);
        let callerProof = merkleTree.getHexProof(callerHash);

        let bubbleBalance = await bubblesContract.balanceOf(
            accounts[10].address
        );
        {
            if (c_verboseLogging) {
                console.log(
                    "bubbleBalance of accounts[10] before claim: %s",
                    bubbleBalance
                );
            }
        }
        await airdropContract
            .connect(accounts[10])
            .claimAirdrop(10, callerProof);
        let newBubbleBalance = await bubblesContract.balanceOf(
            accounts[10].address
        );
        {
            if (c_verboseLogging) {
                console.log(
                    "bubbleBalance of accounts[10] after claim: %s",
                    newBubbleBalance
                );
            }
        }
        expect(bubbleBalance).to.be.lt(newBubbleBalance);

        let version = await airdropContract.version();
        {
            if (c_verboseLogging) {
                console.log("Deploy new merkle tree");
                console.log(
                    "airdropContract version: %s",
                    await airdropContract.version()
                );
            }
        }
        const leafNodes = merkleTreeDB.map(convertEntryToHash);
        const newMerkleTree = new MerkleTree(leafNodes, keccak256, {
            sortPairs: true,
        });
        await airdropContract.setMerkleRoot(merkleTree.getRoot());
        {
            if (c_verboseLogging) {
                console.log(
                    "airdropContract merkleRoot: %s",
                    await airdropContract.merkleRoot()
                );
                console.log(
                    "airdropContract version: %s",
                    await airdropContract.version()
                );
                console.log("Claim with accounts[10] again");
            }
        }
        expect(version).to.be.lt(await airdropContract.version());
        callerProof = newMerkleTree.getHexProof(callerHash);
        await airdropContract
            .connect(accounts[10])
            .claimAirdrop(10, callerProof);
        {
            if (c_verboseLogging) {
                console.log(
                    "bubbleBalance of accounts[10] after 2nd claim: %s",
                    await bubblesContract.balanceOf(accounts[10].address)
                );
            }
        }
        expect(newBubbleBalance).to.be.lt(
            await bubblesContract.balanceOf(accounts[10].address)
        );
    });
});
