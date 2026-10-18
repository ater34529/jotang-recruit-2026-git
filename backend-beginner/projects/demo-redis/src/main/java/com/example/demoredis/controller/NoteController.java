package com.example.demoredis.controller;

import com.example.demoredis.entity.Note;
import com.example.demoredis.service.NoteService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/notes")
public class NoteController {

    @Autowired
    private NoteService noteService;

    @GetMapping("/{id}")
    public Note getById(@PathVariable Long id) {
        return noteService.getById(id);
    }

    @GetMapping
    public List<Note> getAll() {
        return noteService.getAll();
    }

    @PostMapping
    public String add(@RequestBody Note note) {
        return noteService.add(note) > 0 ? "ok" : "fail";
    }

    @PutMapping
    public String update(@RequestBody Note note) {
        return noteService.update(note) > 0 ? "ok" : "fail";
    }

    @DeleteMapping("/{id}")
    public String delete(@PathVariable Long id) {
        return noteService.delete(id) > 0 ? "ok" : "fail";
    }
}