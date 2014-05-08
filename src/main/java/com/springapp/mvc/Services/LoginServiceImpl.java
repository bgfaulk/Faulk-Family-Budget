package com.springapp.mvc.Services;

import com.springapp.mvc.Beans.LoginModel;
import com.springapp.mvc.Repository.LoginDAO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Implementation of LoginService
 *
 * @author Brian Faulk
 */

@Service("loginService")
public class LoginServiceImpl implements LoginService
{
    @Autowired
    LoginDAO loginDAO;

    public boolean validate( LoginModel loginModel )
    {
        return loginDAO.validate( loginModel );
    }
}
