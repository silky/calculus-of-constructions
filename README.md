## Calculus of Constructions

A lightweight implementation of the Calculus of Constructions in JavaScript. CoC is both a minimalistic programming language, similar to the Lambda Calculus, but with a very powerful type system, and a constructive foundation for mathematics.

## Features

- Core calculus as you'd expect, with Lambda, Forall, Variables and, if you don't mind paradoxes, Fix.

- Let bindings as syntax sugars.

- Extremelly minimalistic, unbloated, pure ASCII syntax.

- Completely implemented using [HOAS](https://en.wikipedia.org/wiki/Higher-order_abstract_syntax), including the type checker, which means it is very fast, possibly orders of magnitude faster than implementations using explicit substitutions.

- A robust parser, which allows arbitrary grammar nestings, including of `let`s.

- A smart stringifier, which names variables so that [combinators](https://en.wikipedia.org/wiki/Combinatory_logic) are always stringified the same way, regardless of the context.

- 100% ES5 compliant.

## Syntax

- Lambda: `name:Type Body`

    A function that receives `name` of type `Type` and returns `Body`.

- Forall: `name.ArgType BodyType`

    The type of functions that receive `name` of type `ArgType` and return `BodyType`.

- Fix: `self@ Term`

    The term `Term` with all instances of `self` replaced by itself.

- Apply: `(f x y z)`

    The application of the function `f` to `x`, `y` and `z`.

- Let: `name=Term Body`

    Let `name` be the term `Term` inside the term `Body`.

## Example:

Below, an example implementation of exponentiation:

```haskell
Nat=
  Nat. *
  Succ. (.Nat Nat)
  Zero. Nat
  Nat

two=
  Nat: *
  Succ: (.Nat Nat)
  Zero: Nat
  (Succ (Succ Zero))

exp=
  a: Nat
  b: Nat
  Nat: *
  (b (.Nat Nat) (a Nat))

(exp two two)
```

You can save it as `exp.coc` and run with `coc eval exp.coc`. It is equivalent to this Idris program:

```haskell
NatT : Type
NatT
  =  (Nat : Type)
  -> (Succ : Nat -> Nat)
  -> (Zero : Nat)
  -> Nat

two : NatT
two
  =  \ Nat : Type
  => \ Succ : (Nat -> Nat)
  => \ Zero : Nat
  => Succ (Succ Zero)

exp : NatT -> NatT -> NatT
exp
  =  \ a : NatT
  => \ b : NatT
  => \ Nat : Type
  => b (Nat -> Nat) (a Nat)

printNatT : NatT -> IO ()
printNatT n = print (n Nat (+ 1) 0)

main : IO ()
main = do
  printNatT (exp two two)
```
