/**
 * @depends {nrs.js}
 */
 
 // TODOs, Prio #1:
 // * Show summary for my recieved dividends
 // * Show date, if possible for each transaction?
 // * Test with accounts that has lots of trades+transfers.
 // * Test with accounts that has lots of dividend transactions.
 // * Check function/variable naming convention with documentation and other plug-ins
 // * Move styles to css (where possible)
 
 // TODOs, Prio #2:
 // * Integrate with notification system and show when new dividend transaction has been recieved
 // * Ability to show all assets
 // * Ability to show specific assets
 // * Save transactions in local storage.
 // * Ability to delta load transactions (dependant on save transactions)
 // * Pagination
 // * Use I18N strings
 // * Set up and show modal dialogue
 // * Custom sort and filtering in data table
 // * Refresh button / auto refresh (delta) after x seconds (10? 20?)
 
 // DONE:
 // * Phasing safe (dividend, trade & transfers)
 // * UI, show "no dividend transactions found" when user has no dividend transactions
 // * UI, show loading info when lots of transactions or slow server
 
var NRS = (function(NRS, $, undefined) {	
	var p_dividend_accountAssets = [];
    var p_dividend_dividendTransactions = [];
	var p_dividend_assetOwnership = {};
	var p_dividend_dataLoading;

    NRS.setup.p_dividend = function() {
		p_dividend_dataLoading = $.Deferred();
		p_dividend_getTrades()
			.then(p_dividend_getTransfers)
			.then(p_dividend_sortOwnership)
			.then(p_dividend_getAccountAssets)
			.then(p_dividend_getDividendTransactions)
			.then(p_dividend_filterPhasedDividendTransactions)
			.then(p_dividend_sortDividendTransactions)
			.done(p_dividend_resolve);
    }
	
	p_dividend_resolve = function() {
		p_dividend_dataLoading.resolve();
	}

    NRS.pages.p_dividend = function() {
		if (p_dividend_dataLoading.state() === "resolved") {
			if (p_dividend_dividendTransactions.length > 0) {
				p_dividend_showValues();
			} else {
				p_dividend_showNoDividendTransactions();
			}
		} else if (p_dividend_dataLoading.state() === "pending") {
			p_dividend_dataLoading.done(NRS.pages.p_dividend);
		}
    }
	
	p_dividend_getTransaction = function(transactionId) {
		return $.map(p_dividend_dividendTransactions, function(dividendTransaction) {
			if (dividendTransaction.transaction == transactionId) {
				return dividendTransaction;
			}
		})[0] || null;
	}
	
	p_dividend_getAsset = function(assetId) {
		return $.map(p_dividend_accountAssets, function(accountAsset) {
			if (accountAsset.asset == assetId) {
				return accountAsset;
			}
		})[0] || null;
	}

    p_dividend_showValues = function() {
        var rows = "";
        $.each(p_dividend_dividendTransactions, function(index, transaction) {
            rows += "<tr>";
            rows += "<td>" + transaction.attachment.height + "</td>";
            rows += "<td><a class=\"show_transaction_modal_action\" href=\"#\" data-transaction=\"" 
			     + transaction.transaction + "\">" + transaction.transaction + "</a></td>"
            rows += "<td><a href=\"#\" data-goto-asset=\"" + transaction.attachment.asset + "\">" 
			     + p_dividend_getAsset(transaction.attachment.asset).name + "</a></td>";
			rows += "<td>" + p_dividend_getAssetOwnership(transaction.attachment.asset, transaction.attachment.height) + "</td>";
			rows += "<td style=\"width:5px;padding-right:0;vertical-align:middle;\"><i class=\"fa fa-plus-circle\" style=\"color:#65C62E\"></i></td>";
            rows += "<td style=\"color:#006400;\">" + p_dividend_getDividendForAttachment(transaction.attachment) + "</td>";
            rows += "</tr>";
        });
        NRS.dataLoaded(rows);
    }
	
	p_dividend_showNoDividendTransactions = function() {
		rows = "<tr>";
		rows += "<td colspan=5>No dividend transactions was found</td>";
		rows += "</tr>";
		NRS.dataLoaded(rows);
	}
	
	p_dividend_showLoadingText = function(text) {
		$("#loadingText").text(text);
	}
	
	p_dividend_getDividendForAttachment = function(attachment) {
		var quantityQNT = p_dividend_getAssetOwnershipQNT(attachment.asset, attachment.height);
		
		var NQTearned = attachment.amountNQTPerQNT * quantityQNT;
		var NXTearned = (NQTearned / 100000000).toFixed(8).replace(/\.?0+$/,"");
		
		return NXTearned;
	}

    p_dividend_getAccountAssets = function() {
		p_dividend_showLoadingText("Loading assets..");
        var dfd = $.Deferred();
		var assetIds = $.map(p_dividend_assetOwnership, function(value, key) { return key; });
		NRS.sendRequest("getAssets", { "assets": assetIds, "includeCounts": false }, function(assetsReponse) {
			p_dividend_accountAssets = assetsReponse.assets;
			dfd.resolve(p_dividend_accountAssets);
		});
        return dfd.promise();
    }
	
	p_dividend_getTrades = function() {
		p_dividend_showLoadingText("Loading asset trades..");
		return p_dividend_getTradesAtIndex(0);
	}
	
	p_dividend_getTradesAtIndex = function(index) {
		var dfd = $.Deferred();
		NRS.sendRequest("getTrades", { "account": NRS.account, "firstIndex": index, "lastIndex": index + 99, "includeAssetInfo": false }, function(accountTrades) {
			$.each(accountTrades.trades, function(i, accountTrade) {
				if (p_dividend_assetOwnership[accountTrade.asset] == undefined) {
					p_dividend_assetOwnership[accountTrade.asset] = [];
				}
				var ownershipDelta = p_dividend_convertToOwnershipDelta(accountTrade);
				p_dividend_assetOwnership[accountTrade.asset].push(ownershipDelta);
			});
			if (accountTrades.trades.length == 100) {
				p_dividend_getTradesAtIndex(index + 100).done(function() {
					dfd.resolve();
				});
			}
			else {
				dfd.resolve();
			}
		});
		return dfd.promise();
	}
	
	p_dividend_getTransfers = function() {
		p_dividend_showLoadingText("Loading asset transfers..");
		return p_dividend_getTransfersAtIndex(0);
	}
	
	p_dividend_getTransfersAtIndex = function(index) {
		var dfd = $.Deferred();
		NRS.sendRequest("getAssetTransfers", { "account": NRS.account, "firstIndex": index, "lastIndex": index + 99, "includeAssetInfo": false }, function(assetTransfers) {
			$.each(assetTransfers.transfers, function(i, assetTransfer) {
				if (p_dividend_assetOwnership[assetTransfer.asset] == undefined) {
					p_dividend_assetOwnership[assetTransfer.asset] = [];
				}
				var ownershipDelta = p_dividend_convertToOwnershipDelta(assetTransfer);
				p_dividend_assetOwnership[assetTransfer.asset].push(ownershipDelta);
			});
			if (assetTransfers.transfers.length == 100) {
				p_dividend_getTransfersAtIndex(index + 100).done(function() {
					dfd.resolve();
				});
			}
			else {
				dfd.resolve();
			}
		});
		return dfd.promise();
	}
	
	p_dividend_convertToOwnershipDelta = function(transaction) {
		var ownerUpdate = {
			quantityQNT: parseInt(transaction.quantityQNT),
			height: transaction.height
		};
		if ((transaction.sender !== undefined && transaction.sender == NRS.account) ||
		    (transaction.seller !== undefined && transaction.seller == NRS.account)) {
			ownerUpdate.quantityQNT = -ownerUpdate.quantityQNT;
		}
		return ownerUpdate;
	}
	
	p_dividend_sortOwnership = function() {
		$.each(p_dividend_assetOwnership, function(assetId, ownershipArray) {
			ownershipArray.sort(function(a, b) {
				if (a.height > b.height) return 1;
				return -1;
			});
		});
	}
	
    p_dividend_getDividendTransactions = function() {
		p_dividend_showLoadingText("Loading dividend transactions..");
		return p_dividend_getDividendTransaction(0);
	}

    p_dividend_getDividendTransaction = function(assetIndex) {
        var dfd = $.Deferred();
        var exists = false;
        $.each(p_dividend_dividendTransactions, function(i, dividendTransaction) {
            if (dividendTransaction.sender == p_dividend_accountAssets[assetIndex].account) {
                exists = true;
            }
        });
        if (!exists) {
            NRS.sendRequest("getBlockchainTransactions", {
                "account": p_dividend_accountAssets[assetIndex].account,
                "type": 2,
                "subtype": 6
            }, function(dividendTransactionsReply) {
                $.each(dividendTransactionsReply.transactions, function(i, transaction) {
					if (p_dividend_getAsset(transaction.attachment.asset) !== null && 
						p_dividend_getAssetOwnershipQNT(transaction.attachment.asset, transaction.attachment.height) > 0) {
						p_dividend_dividendTransactions.push(transaction);
					}
                });
                if (p_dividend_accountAssets.length > assetIndex + 1) {
                    p_dividend_getDividendTransaction(assetIndex + 1).done(function() {
                        dfd.resolve();
                    });
                } else {
                    dfd.resolve();
                }
            });
        } else {
            if (p_dividend_accountAssets.length > assetIndex + 1) {
                p_dividend_getDividendTransaction(assetIndex + 1).done(function() {
                    dfd.resolve();
                });
            } else {
                dfd.resolve();
            }
        }
        return dfd.promise();
    }
	
	p_dividend_filterPhasedDividendTransactions = function() {
        var dfd = $.Deferred();
		var phasedTransactions = $.map(p_dividend_dividendTransactions, function(dividendTransaction) {
			if (dividendTransaction.phased) {
				return dividendTransaction.transaction;
			}
		});
		if (phasedTransactions.length > 0) {
			NRS.sendRequest("getPhasingPolls", { "transaction": phasedTransactions, "countVotes": false }, function(phasingPolls) {
				$.each(phasingPolls.polls, function(i, poll) {
					if (!poll.finished || !poll.approved) {
						var transaction = p_dividend_getTransaction(poll.transaction);
						var index = p_dividend_dividendTransactions.indexOf(transaction)
						p_dividend_dividendTransactions.splice(index, 1);
					}
				});
				dfd.resolve();
			});
		} else {
			dfd.resolve();
		}
        return dfd.promise();
	}
	
	p_dividend_getAssetOwnershipQNT = function(assetId, height) {
		var quantityQNT = 0;
		$.each(p_dividend_assetOwnership[assetId], function(i, delta) {
			if (delta.height < height) {
				quantityQNT += delta.quantityQNT;
			} else {
				return false;
			}
		});
		return quantityQNT;
	}
	
	p_dividend_getAssetOwnership = function(assetId, height) {
		var quantityQNT = p_dividend_getAssetOwnershipQNT(assetId, height);
		var asset = p_dividend_getAsset(assetId);
		decimalMultiplier = Math.pow(10, asset.decimals);
		return (quantityQNT / decimalMultiplier).toFixed(8).replace(/\.?0+$/, "");
	}
	
	p_dividend_sortDividendTransactions = function() {
		p_dividend_dividendTransactions.sort(function(a, b) {
			if (a.attachment.height < b.attachment.height) return 1;
			return -1;
		});
	}

    return NRS;
}(NRS || {}, jQuery));

//File name for debugging (Chrome/Firefox)
//@ sourceURL=nrs.dividend.js