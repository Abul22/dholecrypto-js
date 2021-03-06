const assert = require('assert');
const expect = require('chai').expect;
const Asymmetric = require('../lib/Asymmetric');
const AsymmetricSecretKey = require('../lib/key/AsymmetricSecretKey');
const AsymmetricPublicKey = require('../lib/key/AsymmetricPublicKey');
const SymmetricKey = require('../lib/key/SymmetricKey');

const Util = require('../lib/Util');
const base64url = require('rfc4648').base64url;
const hex = require('rfc4648').base16;
const loadJsonFile = require('load-json-file');

describe('Asymmetric.encrypt()', function () {
    it('should allow messages to encrypt', function () {
        let aliceSk = AsymmetricSecretKey.generate();
        let alicePk = aliceSk.getPublicKey();
        let bobSk = AsymmetricSecretKey.generate();
        let bobPk = bobSk.getPublicKey();

        let message = "This is a super secret message UwU";
        let encrypted = Asymmetric.encrypt(message, alicePk, bobSk);
        let decrypted = Asymmetric.decrypt(encrypted, aliceSk, bobPk);
        expect(message).to.be.equal(decrypted);
    });

    it('should pass the standard test vectors', function() {
        return loadJsonFile('./test/test-vectors.json').then(json => {
            let participants = {};
            let test;

            // Load all of our participants...
            let k;
            let t;
            for (k in json.asymmetric.participants) {
                participants[k] = {};
                participants[k].sk = new AsymmetricSecretKey(
                    base64url.parse(json.asymmetric.participants[k]['secret-key'])
                );
                participants[k].pk = new AsymmetricPublicKey(
                    base64url.parse(json.asymmetric.participants[k]['public-key'])
                );
            }

            let result;
            for (t = 0; t < json.asymmetric.encrypt.length; t++) {
                test = json.asymmetric.encrypt[t];
                result = Asymmetric.decrypt(
                    test.encrypted,
                    participants[test.recipient].sk,
                    participants[test.sender].pk
                ).toString('binary');
                expect(test.decrypted).to.be.equal(result);
            }
        }).catch(function(e) {
            assert.fail(e);
        });
    });
});

describe('Asymmetric.keyExchange()', function () {
    it('should generate congruent shared secrets', function() {
        let alice = AsymmetricSecretKey.generate();
        let bob = AsymmetricSecretKey.generate();

        let testA = Asymmetric.keyExchange(alice, bob.getPublicKey(), true)
            .getBuffer().toString('hex');
        let testB = Asymmetric.keyExchange(bob, alice.getPublicKey(), false)
            .getBuffer().toString('hex');
        let testC = Asymmetric.keyExchange(alice, bob.getPublicKey(), false)
            .getBuffer().toString('hex');
        let testD = Asymmetric.keyExchange(bob, alice.getPublicKey(), true)
            .getBuffer().toString('hex');

        // Standard sanity checks:
        expect(testA).to.be.equal(testB);
        expect(testC).to.be.equal(testD);
        expect(testA).to.not.be.equal(testC);
        expect(testB).to.not.be.equal(testD);

        // Extra test: Don't accept all-zero shared secrets
        expect(testA).to.not.be.equal(
            '0000000000000000000000000000000000000000000000000000000000000000'
        );
        expect(testC).to.not.be.equal(
            '0000000000000000000000000000000000000000000000000000000000000000'
        );
    });

    it('should pass the standard test vectors', function() {
        return loadJsonFile('./test/test-vectors.json').then(json => {
            let participants = {};
            let shared = {};
            let test;

            // Load all of our participants...
            let k;
            for (k in json.asymmetric.participants) {
                participants[k] = {};
                participants[k].sk = new AsymmetricSecretKey(
                    base64url.parse(json.asymmetric.participants[k]['secret-key'])
                );
                participants[k].pk = new AsymmetricPublicKey(
                    base64url.parse(json.asymmetric.participants[k]['public-key'])
                );
                expect(
                    participants[k].sk.getPublicKey().getBuffer().toString('hex')
                ).to.be.equal(
                    participants[k].pk.getBuffer().toString('hex')
                );
            }
            // Let's also load up the symmetric keys to double-check our kx logic...
            for (k in json.symmetric.keys) {
                shared[k] = new SymmetricKey(
                    base64url.parse(json.symmetric.keys[k])
                );
            }

            // Fox to Wolf
            test = Asymmetric.keyExchange(
                participants['fox'].sk,
                participants['wolf'].pk,
                true
            ).getBuffer().toString('hex');
            expect(test).to.be.equal(
                shared['fox-to-wolf'].getBuffer().toString('hex')
            );

            // Wolf to Fox
            test = Asymmetric.keyExchange(
                participants['wolf'].sk,
                participants['fox'].pk,
                true
            ).getBuffer().toString('hex');
            expect(test).to.be.equal(
                shared['wolf-to-fox'].getBuffer().toString('hex')
            );

            // Fox from Wolf
            test = Asymmetric.keyExchange(
                participants['fox'].sk,
                participants['wolf'].pk,
                false
            ).getBuffer().toString('hex');
            expect(test).to.be.equal(
                shared['fox-from-wolf'].getBuffer().toString('hex')
            );

            // Wolf from Fox
            test = Asymmetric.keyExchange(
                participants['wolf'].sk,
                participants['fox'].pk,
                false
            ).getBuffer().toString('hex');
            expect(test).to.be.equal(
                shared['wolf-from-fox'].getBuffer().toString('hex')
            );

        }).catch(function(e) {
            assert.fail(e);
        });
    });
});

describe('Asymmetric.seal()', function () {
    it('should allow messages to seal/unseal', function () {
        let aliceSk = AsymmetricSecretKey.generate();
        let alicePk = aliceSk.getPublicKey();
        let message = "This is a super secret message UwU";
        let sealed = Asymmetric.seal(message, alicePk);
        let unseal = Asymmetric.unseal(sealed, aliceSk);
        expect(message).to.be.equal(unseal);
    });

    it('should pass the standard test vectors', function() {
        return loadJsonFile('./test/test-vectors.json').then(json => {
            let participants = {};
            let test;

            // Load all of our participants...
            let k;
            let t;
            for (k in json.asymmetric.participants) {
                participants[k] = {};
                participants[k].sk = new AsymmetricSecretKey(
                    base64url.parse(json.asymmetric.participants[k]['secret-key'])
                );
                participants[k].pk = new AsymmetricPublicKey(
                    base64url.parse(json.asymmetric.participants[k]['public-key'])
                );
            }

            let result;
            for (t = 0; t < json.asymmetric.seal.length; t++) {
                test = json.asymmetric.seal[t];
                result = Asymmetric.unseal(
                    test.sealed,
                    participants[test.recipient].sk
                ).toString('binary');
                expect(test.unsealed).to.be.equal(result);
            }
        }).catch(function(e) {
            assert.fail(e);
        });
    });
});

describe('Asymmetric.sign()', function () {
    it('should allow messages to sign/verify', function () {
        let aliceSk = AsymmetricSecretKey.generate();
        let alicePk = aliceSk.getPublicKey();
        let message = "This is a super secret message UwU";
        let sig = Asymmetric.sign(message, aliceSk);
        assert(Asymmetric.verify(message, alicePk, sig), 'Signatures not valid');
    });

    it('should pass the standard test vectors', function() {
        return loadJsonFile('./test/test-vectors.json').then(json => {
            let participants = {};
            let test;

            // Load all of our participants...
            let k;
            let t;
            for (k in json.asymmetric.participants) {
                participants[k] = {};
                participants[k].sk = new AsymmetricSecretKey(
                    base64url.parse(json.asymmetric.participants[k]['secret-key'])
                );
                participants[k].pk = new AsymmetricPublicKey(
                    base64url.parse(json.asymmetric.participants[k]['public-key'])
                );
            }

            let signed;
            let result;
            for (t = 0; t < json.asymmetric.sign.length; t++) {
                test = json.asymmetric.sign[t];
                signed = Asymmetric.sign(
                    test.message,
                    participants[test.signer].sk
                );
                result = Asymmetric.verify(
                    test.message,
                    participants[test.signer].pk,
                    signed
                );
                expect(result).to.be.equal(true);

                result = Asymmetric.verify(
                    test.message,
                    participants[test.signer].pk,
                    test.signature
                );
                expect(result).to.be.equal(true);
            }
        }).catch(function(e) {
            assert.fail(e);
        });
    });
});
