package com.springapp.mvc.Controller;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.servlet.ModelAndView;
import org.springframework.web.servlet.view.RedirectView;

@Controller
public class HelloController
{
    private final static String LOGIN_JSP = "/logIn";
    private final static String BUDGET_JSP = "/budget";

    //loads logIn page
    @RequestMapping(value = LOGIN_JSP, method = RequestMethod.GET)
    public ModelAndView logIn()
    {
        return new ModelAndView( LOGIN_JSP );
    }

    //Returns the budget page once a user has logged in
    @RequestMapping(value = BUDGET_JSP, method = RequestMethod.GET)
    public ModelAndView budgetPage(Model model)
    {
        return new ModelAndView( BUDGET_JSP );
    }
}