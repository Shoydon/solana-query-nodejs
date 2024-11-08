const arangojs = require("arangojs");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const db = new arangojs.Database({
    url: "http://ec2-13-61-3-35.eu-north-1.compute.amazonaws.com:8529",
    databaseName: "solana",
    auth: { username: "root", password: "shoydon" },
});

const app = express();
app.use(bodyParser.json());
app.use(cors());

// get_block
app.get("/block/:block_number", (req, res) => {
    const { block_number } = req.params;
    db.query(`
        FOR b IN blocks
        FILTER b._key == '${block_number}'
        RETURN b
    `)
    .then(cursor => cursor.next())
    .then(block => {
        if (block) {
            res.status(200).json(block);
        } else {
            res.status(404).json({ message: "Block not found" });
        }
    })
    .catch(error => {
        console.error("Error retrieving block:", error);
        res.status(500).json({ message: "Internal server error" });
    });
});

// get_block_by_timestamp
app.get("/block/timestamp/:timestamp", (req, res) => {
    const { timestamp } = req.params;
    db.query(`
        FOR b IN blocks
        FILTER b.timestamp == ${timestamp}
        RETURN b
    `)
    .then(cursor => cursor.all())
    .then(blocks => {
        if (blocks.length > 0) {
            res.status(200).json(blocks);
        } else {
            res.status(404).json({ message: `No blocks found with timestamp ${timestamp}` });
        }
    })
    .catch(error => {
        console.error("Error retrieving blocks by timestamp:", error);
        res.status(500).json({ message: "Internal server error" });
    });
});

// get_program_in_transaction
app.get("/tx/:sign/programs", (req, res) => {
    const { sign } = req.params;
    const t_sign = `transactions/${sign}`;
    db.query(`
        FOR tp IN interact_with
        FILTER tp._from == '${t_sign}'
        RETURN tp._to
    `)
    .then(cursor => cursor.all())
    .then(programs => {
        if (programs.length > 0) {
            res.status(200).json(programs);
        } else {
            res.status(404).json({ message: `No programs found for transaction ${sign}` });
        }
    })
    .catch(error => {
        console.error("Error retrieving transaction programs:", error);
        res.status(500).json({ message: "Internal server error" });
    });
});

// get_log_in_transaction
app.get("/tx/:sign/logs", (req, res) => {
    const { sign } = req.params;
    db.query(`
        FOR tx IN transactions
        FILTER tx.signature == '${sign}'
        RETURN tx.metadata.logMessages
    `)
    .then(cursor => cursor.all())
    .then(logs => {
        if (logs.length > 0) {
            res.status(200).json(logs);
        } else {
            res.status(404).json({ message: `No logs found for transaction ${sign}` });
        }
    })
    .catch(error => {
        console.error("Error retrieving transaction logs:", error);
        res.status(500).json({ message: "Internal server error" });
    });
});

// get_signer_of_transaction
app.get("/tx/:sign/signer", (req, res) => {
    const { sign } = req.params;
    db.query(`
        FOR tx IN transactions
        FILTER tx.signature == '${sign}'
        RETURN tx.transaction_data.message.accountKeys[0].pubkey
    `)
    .then(cursor => cursor.all())
    .then(signer => {
        if (signer.length > 0) {
            res.status(200).json(signer);
        } else {
            res.status(404).json({ message: `No signer found for transaction ${sign}` });
        }
    })
    .catch(error => {
        console.error("Error retrieving transaction signer:", error);
        res.status(500).json({ message: "Internal server error" });
    });
});

// get_transaction
app.get("/tx/:sign/full", (req, res) => {
    const { sign } = req.params;
    db.query(`For tx IN transactions FILTER tx.signature == '${sign}' RETURN tx`)
    .then(cursor => cursor.all())
    .then(tx => {
        if (tx.length > 0) {
            res.status(200).json(tx);
        } else {
            res.status(404).json({message: `No tx found for ${sign}`});
        }
    })
    .catch(error => {
        console.error("Error retriving transactions: ", error);
        res.status(500).json({message: "Internal server error"});
    })
})

// get_account_transaction
app.get("/account/:address/transactions", (req, res) => {
    const { address } = req.params;
    db.query(`
        FOR p IN address
        FILTER p.address == '${address}'
        LET transactions = (
            FOR e IN account_transaction_edges
            FILTER e._from == p._id
            RETURN e._to
        )
        RETURN { no_of_transactions: p.no_of_transactions, transaction_ids: transactions }
    `)
    .then(cursor => cursor.next())
    .then(account => {
        if (account) {
            res.status(200).json(account);
        } else {
            res.status(404).json({ message: "Account not found" });
        }
    })
    .catch(error => {
        console.error("Error retrieving account transactions:", error);
        res.status(500).json({ message: "Internal server error" });
    });
});

// get_tx_of_program
app.get("/program/:program_id/transactions", (req, res) => {
    const { program_id } = req.params;
    db.query(`
        FOR pid IN interact_with
        FILTER pid._to == CONCAT('program/', '${program_id}')
        RETURN pid._from
    `)
    .then(cursor => cursor.all())
    .then(transactions => {
        if (transactions.length > 0) {
            res.status(200).json(transactions);
        } else {
            res.status(404).json({ message: `No transactions found for program ${program_id}` });
        }
    })
    .catch(error => {
        console.error("Error retrieving program transactions:", error);
        res.status(500).json({ message: "Internal server error" });
    });
});

// get_program_logs
app.get("/program/:program_id/logs", (req, res) => {
    const { program_id } = req.params;
    db.query(`
        FOR p IN interact_with
        FILTER p._to == CONCAT('program/', '${program_id}')
        FOR t IN transactions
        FILTER t._id == p._from
        RETURN { tx: t.signature, log: t.metadata.logMessages }
    `)
    .then(cursor => cursor.all())
    .then(logs => {
        if (logs.length > 0) {
            res.status(200).json(logs);
        } else {
            res.status(404).json({ message: `No logs found for program ${program_id}` });
        }
    })
    .catch(error => {
        console.error("Error retrieving program logs:", error);
        res.status(500).json({ message: "Internal server error" });
    });
});

// get_account_of_program_with_filter
app.get("/program/:program_id/accounts/:start_block/:end_block", (req, res) => {
    const { program_id, start_block, end_block } = req.params;
    db.query(`
        FOR pid IN trrigers
        FILTER pid._to == CONCAT('program/', '${program_id}')
        FOR t IN transactions
        FILTER t.signature == pid.tx
        FILTER t.slot >= ${start_block} AND t.slot <= ${end_block}
        RETURN { address: pid._from, slot: t.slot, tx: pid.tx }
    `)
    .then(cursor => cursor.all())
    .then(accounts => {
        if (accounts.length > 0) {
            res.status(200).json(accounts);
        } else {
            res.status(404).json({ message: `No accounts found for program ${program_id} in specified slot range` });
        }
    })
    .catch(error => {
        console.error("Error retrieving program accounts within slot range:", error);
        res.status(500).json({ message: "Internal server error" });
    });
});

// query_program_account
app.get("/program/:program_id/accounts", (req, res) => {
    const { program_id } = req.params;
    db.query(`
        FOR pid IN trrigers
        FILTER pid._to == CONCAT('program/', '${program_id}')
        RETURN {
            address: pid._from,
            tx: pid.tx
        }
    `)
    .then(cursor => cursor.all())
    .then(result => {
        if (result.length > 0) {
            res.status(200).json(result);
        } else {
            res.status(404).json({ message: `No program ID ${program_id} found` });
        }
    })
    .catch(error => {
        console.error("Error retrieving program account:", error);
        res.status(500).json({ message: "Internal server error" });
    });
});

// query_program_tx_with_filter
app.get("/program/:program_id/transactions/:start_block/:end_block", (req, res) => {
    const { program_id, start_block, end_block } = req.params;
    db.query(`
        FOR pid IN interact_with
        FILTER pid._to == CONCAT('program/', @programId)
        FOR t IN transactions
        FILTER t._id == pid._from
        FILTER t.slot >= @startBlock AND t.slot <= @endBlock
        RETURN {
            tx: t.signature,
            slot: t.slot
        }
    `, { programId: program_id, startBlock: parseInt(start_block), endBlock: parseInt(end_block) })
    .then(cursor => cursor.all())
    .then(result => {
        if (result.length > 0) {
            res.status(200).json(result);
        } else {
            res.status(404).json({ message: `No program ID ${program_id} found in the specified slot range` });
        }
    })
    .catch(error => {
        console.error("Error retrieving program transactions with filter:", error);
        res.status(500).json({ message: "Internal server error" });
    });
});

// query_program_logs_with_filter
app.get("/program/:program_id/logs/:start_block/:end_block", (req, res) => {
    const { program_id, start_block, end_block } = req.params;
    db.query(`
        FOR p IN interact_with
        FILTER p._to == CONCAT('program/', @programId)
        FOR t IN transactions
        FILTER t.slot >= @startBlock AND t.slot <= @endBlock
        FILTER t._id == p._from
        RETURN {
            signature: t.signature,
            slot: t.slot,
            log: t.metadata.logMessages
        }
    `, { programId: program_id, startBlock: parseInt(start_block), endBlock: parseInt(end_block) })
    .then(cursor => cursor.all())
    .then(result => {
        if (result.length > 0) {
            res.status(200).json(result);
        } else {
            res.status(404).json({ message: `No logs found for program ID ${program_id} between blocks ${start_block} and ${end_block}` });
        }
    })
    .catch(error => {
        console.error("Error retrieving program logs with filter:", error);
        res.status(500).json({ message: "Internal server error" });
    });
});

app.get("/", (req, res) => {
    res.send("success");
});


// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
