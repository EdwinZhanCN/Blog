---
title: A smart way to start with Go
description: 本章将站在一个更加有趣的视角快速掌握Go语言的精华
pubDate: 2026-04-20
updatedDate: 2026-04-20
heroImage:
tags:
  - Programming-Language
  - Go
draft: false
---
## 值语义

在很多现代编程语言中，如Java, 他们的默认思维是操作一个对象，而Go中没有面向对象的概念，也没有Class. 我们看下面这个实例代码：

```go
type Person struct {
    Name string
    Age  int
}

func change(p Person) {
    p.Age = 30
}

func main() {
    p := Person{"Alice", 20}
    change(p)

	// 20
    fmt.Println(p.Age)
}
```

通常，我们会期望输出结果是 `30` ，因为 change function 改变了一个传入“对象”的属性，但是在这段代码中，传入 `func change` 的是一个 `Person` 的复制, 所以结果是 `20` 。

如果要改变原始数据，我们需要用到类似C的指针概念

```go
func change(p *Person) {
    p.Age = 30
}

// 并且调用 change(&p)
```

这里就是 Go 与 C++/Java 最大的区别。Java 中的变量是 **对象引用**, 而 Go 中的变量是 **值**，且 **值** 里面 **可能包含引用**。

## Slice: 另类的数据结构

如果你看到下面这段代码

```go
a := []int{1,2,3}
b := a
```

你可能下意识认为这是复制数组！类似 Python! 但是在 Go 中，Slice 仅仅只是一个异常简单的小结构

```go
type slice struct {
    ptr *int
    len int
    cap int
}
```

所以， `b := a` 仅仅只是复制这个结构体中的 **值** 而已。

## Interface: 行为约束，至上而下

以 Java 举例，通常我们会写

```java
class Dog implements Animal
```

Go:

```go
type Animal interface{
	Speak()
}

type Dog struct{}

func (Dog) Speak(){
	fmt.Println("wang")
}
```

在Java中，更像是我们先定义什么是 Animal, 然后让各种 Animals 围绕这个初始定义去实现各种不同的 Animal.

而在 Go 中，更像是我们寻找 Dog, Cat, 和 Parrot 之间的共性，例如，他们都会 Speak(), 所以，他们就是 Animal. 在上述代码中，Dog 会自动实现 Animal，不需要任何声明。

### nil interface: 值/类型分离

看这段代码

```go
var p *User=nil

var x interface{} = p
```

通常我们可以断言 `x == nil`. 但是 Go 的 interface 与我们预想的有些许不同

```go
interface {
	type
	value
}
//所以，上述代码中的x实际上他的type是有值的，是一个*User Pointer，即使value=nil，这不代表interface本身是空。
```

Interface: what it can do not what it is.

