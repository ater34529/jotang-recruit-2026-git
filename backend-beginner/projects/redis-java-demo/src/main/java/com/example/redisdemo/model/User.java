package com.example.redisdemo.model;

/**
 * 代表 MySQL 表里的一行记录（这里以用户表为例）。
 *
 * 注意：必须保留一个「无参构造器」，Gson 把 JSON 字符串还原成对象时要用到它。
 */
public class User {

    private Long id;      // 主键
    private String name;  // 姓名
    private Integer age;  // 年龄
    private String phone; // 手机号

    public User() {
    }

    public User(Long id, String name, Integer age, String phone) {
        this.id = id;
        this.name = name;
        this.age = age;
        this.phone = phone;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Integer getAge() {
        return age;
    }

    public void setAge(Integer age) {
        this.age = age;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    @Override
    public String toString() {
        return "User{id=" + id + ", name='" + name + "', age=" + age + ", phone='" + phone + "'}";
    }
}
